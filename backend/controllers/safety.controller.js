import mongoose from "mongoose";
import User from "../models/user.model.js";
import { NOTIF_TYPES } from "../lib/utils/notify.js";

const PUBLIC_FIELDS = "username fullName profileImg";
const AUDIENCE = ["everyone", "following", "nobody"];

const loadTarget = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.isValidObjectId(id)) {
		res.status(404).json({ error: "User not found" });
		return null;
	}
	if (id === req.user._id.toString()) {
		res.status(400).json({ error: "You can't do that to yourself" });
		return null;
	}
	const target = await User.findById(id).select("_id");
	if (!target) {
		res.status(404).json({ error: "User not found" });
		return null;
	}
	return target;
};

export const getSafety = async (req, res) => {
	try {
		const me = await User.findById(req.user._id)
			.select("mutedUsers blockedUsers mutedWords settings")
			.populate({ path: "mutedUsers", select: PUBLIC_FIELDS })
			.populate({ path: "blockedUsers", select: PUBLIC_FIELDS });

		res.status(200).json({
			mutedUsers: me.mutedUsers,
			blockedUsers: me.blockedUsers,
			mutedWords: me.mutedWords,
			settings: {
				whoCanMessage: me.settings?.whoCanMessage || "everyone",
				whoCanReply: me.settings?.whoCanReply || "everyone",
			},
		});
	} catch (error) {
		console.log("Error in getSafety: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const muteUnmuteUser = async (req, res) => {
	try {
		const target = await loadTarget(req, res);
		if (!target) return;

		const me = await User.findById(req.user._id).select("mutedUsers");
		const isMuted = me.mutedUsers.some((id) => id.equals(target._id));

		await User.updateOne(
			{ _id: me._id },
			isMuted ? { $pull: { mutedUsers: target._id } } : { $addToSet: { mutedUsers: target._id } }
		);
		res.status(200).json({ muted: !isMuted });
	} catch (error) {
		console.log("Error in muteUnmuteUser: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const blockUnblockUser = async (req, res) => {
	try {
		const target = await loadTarget(req, res);
		if (!target) return;

		const me = await User.findById(req.user._id).select("blockedUsers");
		const isBlocked = me.blockedUsers.some((id) => id.equals(target._id));

		if (isBlocked) {
			await User.updateOne({ _id: me._id }, { $pull: { blockedUsers: target._id } });
		} else {
			// blocking also removes the follow relationship in both directions
			await User.updateOne(
				{ _id: me._id },
				{ $addToSet: { blockedUsers: target._id }, $pull: { following: target._id, followers: target._id } }
			);
			await User.updateOne({ _id: target._id }, { $pull: { following: me._id, followers: me._id } });
		}
		res.status(200).json({ blocked: !isBlocked });
	} catch (error) {
		console.log("Error in blockUnblockUser: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const updateMutedWords = async (req, res) => {
	try {
		const raw = Array.isArray(req.body.words) ? req.body.words : [];
		const words = [
			...new Set(
				raw
					.filter((w) => typeof w === "string")
					.map((w) => w.trim().toLowerCase().slice(0, 40))
					.filter(Boolean)
			),
		].slice(0, 50);

		await User.updateOne({ _id: req.user._id }, { mutedWords: words });
		res.status(200).json({ mutedWords: words });
	} catch (error) {
		console.log("Error in updateMutedWords: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const updatePrivacySettings = async (req, res) => {
	try {
		const { whoCanMessage, whoCanReply } = req.body;
		const update = {};
		if (whoCanMessage !== undefined) {
			if (!AUDIENCE.includes(whoCanMessage)) return res.status(400).json({ error: "Invalid option" });
			update["settings.whoCanMessage"] = whoCanMessage;
		}
		if (whoCanReply !== undefined) {
			if (!AUDIENCE.includes(whoCanReply)) return res.status(400).json({ error: "Invalid option" });
			update["settings.whoCanReply"] = whoCanReply;
		}
		if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });

		const me = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select("settings");
		res.status(200).json({ settings: me.settings });
	} catch (error) {
		console.log("Error in updatePrivacySettings: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const updateNotificationPrefs = async (req, res) => {
	try {
		const update = {};
		for (const type of NOTIF_TYPES) {
			if (typeof req.body[type] === "boolean") update[`notifPrefs.${type}`] = req.body[type];
		}
		if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to change" });
		const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true }).select("notifPrefs");
		res.status(200).json(user.notifPrefs);
	} catch (error) {
		console.log("Error in updateNotificationPrefs: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
