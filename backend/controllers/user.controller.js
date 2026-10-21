import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";

// models
import { notify } from "../lib/utils/notify.js";
import User from "../models/user.model.js";
import { findUserByUsername, escapeRegex } from "../lib/utils/findUser.js";
import { isBlockedBetween, getHiddenUserIds } from "../lib/utils/relations.js";
import { PUBLIC_USER } from "../lib/utils/publicUser.js";
import { isAdmin } from "../lib/utils/admin.js";
import { generateTokenAndSetCookie } from "../lib/utils/generateToken.js";
import { sendVerificationEmail } from "./auth.controller.js";

export const getUserProfile = async (req, res) => {
	const { username } = req.params;

	try {
		const user = await findUserByUsername(username).select(PUBLIC_USER);
		if (!user) return res.status(404).json({ message: "User not found" });

		res.status(200).json(user);
	} catch (error) {
		console.log("Error in getUserProfile: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const followUnfollowUser = async (req, res) => {
	try {
		const { id } = req.params;
		const userToModify = await User.findById(id);
		const currentUser = await User.findById(req.user._id);

		if (id === req.user._id.toString()) {
			return res.status(400).json({ error: "You can't follow/unfollow yourself" });
		}

		if (!userToModify || !currentUser) return res.status(400).json({ error: "User not found" });

		if (await isBlockedBetween(req.user._id, id)) {
			return res.status(403).json({ error: "You can't follow this account" });
		}

		const isFollowing = currentUser.following.includes(id);

		if (isFollowing) {
			// Unfollow the user
			await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });

			res.status(200).json({ message: "User unfollowed successfully" });
		} else {
			// Follow the user
			await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
			// Send notification to the user
			await notify({ from: req.user._id, to: userToModify._id, type: "follow" });

			res.status(200).json({ message: "User followed successfully" });
		}
	} catch (error) {
		console.log("Error in followUnfollowUser: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getSuggestedUsers = async (req, res) => {
	try {
		const userId = req.user._id;

		const usersFollowedByMe = await User.findById(userId).select("following");
		const hiddenIds = await getHiddenUserIds(userId);

		const users = await User.aggregate([
			{
				$match: {
					_id: { $ne: userId, $nin: hiddenIds },
				},
			},
			{ $sample: { size: 10 } },
			{ $project: { username: 1, fullName: 1, profileImg: 1, bio: 1 } },
		]);

		// 1,2,3,4,5,6,
		const filteredUsers = users.filter((user) => !usersFollowedByMe.following.includes(user._id));
		const suggestedUsers = filteredUsers.slice(0, 4);

		res.status(200).json(suggestedUsers);
	} catch (error) {
		console.log("Error in getSuggestedUsers: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const searchUsers = async (req, res) => {
	try {
		const q = String(req.query.q ?? "").trim().slice(0, 40);
		if (q.length < 1) return res.status(200).json([]);

		const regex = new RegExp(escapeRegex(q), "i");
		const me = await User.findById(req.user._id).select("blockedUsers");
		const blockedMe = await User.find({ blockedUsers: req.user._id }).select("_id");
		const excluded = [req.user._id, ...(me?.blockedUsers || []), ...blockedMe.map((u) => u._id)];

		const users = await User.find({
			_id: { $nin: excluded },
			$or: [{ username: regex }, { fullName: regex }],
		})
			.select("username fullName profileImg bio")
			.limit(20);

		res.status(200).json(users);
	} catch (error) {
		console.log("Error in searchUsers: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const completeOnboarding = async (req, res) => {
	try {
		await User.updateOne({ _id: req.user._id }, { needsOnboarding: false });
		res.status(200).json({ done: true });
	} catch (error) {
		console.log("Error in completeOnboarding: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const updateUser = async (req, res) => {
	const { fullName, email, username, currentPassword, newPassword, bio, link } = req.body;
	let { profileImg, coverImg } = req.body;

	const userId = req.user._id;

	try {
		let user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if (username && username.trim() !== user.username) {
			const cleanUsername = username.trim();
			if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
				return res
					.status(400)
					.json({ error: "Username must be 3-20 characters: letters, numbers or underscore, no spaces" });
			}
			// an admin is named in ADMIN_USERNAMES; renaming would free that name for anyone to register
			if (isAdmin(user)) {
				return res.status(400).json({ error: "Admin accounts can't change username. Update ADMIN_USERNAMES first." });
			}
			const taken = await findUserByUsername(cleanUsername);
			if (taken && taken._id.toString() !== user._id.toString()) {
				return res.status(400).json({ error: "Username is already taken" });
			}
		}

		let emailChanged = false;
		if (email && email.trim().toLowerCase() !== user.email) {
			emailChanged = true;
			const cleanEmail = email.trim().toLowerCase();
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
				return res.status(400).json({ error: "Invalid email format" });
			}
			const emailTaken = await User.findOne({ email: cleanEmail });
			if (emailTaken && emailTaken._id.toString() !== user._id.toString()) {
				return res.status(400).json({ error: "Email is already taken" });
			}
			// changing the email changes where password resets go, so ask for the password
			if (!currentPassword) {
				return res.status(400).json({ error: "Enter your current password to change your email" });
			}
			if (!(await bcrypt.compare(currentPassword, user.password))) {
				return res.status(400).json({ error: "Current password is incorrect" });
			}
		}

		if (typeof bio === "string" && bio.length > 160) {
			return res.status(400).json({ error: "Bio can be at most 160 characters" });
		}
		let cleanLink;
		if (typeof link === "string") {
			cleanLink = link.trim();
			if (cleanLink.length > 100) {
				return res.status(400).json({ error: "Link can be at most 100 characters" });
			}
			if (cleanLink) {
				if (!/^https?:\/\//i.test(cleanLink)) cleanLink = `https://${cleanLink}`;
				if (!/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(cleanLink)) {
					return res.status(400).json({ error: "That link doesn't look right. Example: https://example.com" });
				}
			}
		}

		if ((!newPassword && currentPassword && !emailChanged) || (!currentPassword && newPassword)) {
			return res.status(400).json({ error: "Please provide both current password and new password" });
		}

		let passwordChanged = false;
		if (currentPassword && newPassword) {
			const isMatch = await bcrypt.compare(currentPassword, user.password);
			if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });
			if (newPassword.length < 6) {
				return res.status(400).json({ error: "Password must be at least 6 characters long" });
			}

			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(newPassword, salt);
			user.passwordChangedAt = new Date();
			passwordChanged = true;
		}

		if (profileImg) {
			if (user.profileImg) {
				// https://res.cloudinary.com/dyfqon1v6/image/upload/v1712997552/zmxorcxexpdbh8r0bkjb.png
				await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0]);
			}

			const uploadedResponse = await cloudinary.uploader.upload(profileImg);
			profileImg = uploadedResponse.secure_url;
		}

		if (coverImg) {
			if (user.coverImg) {
				await cloudinary.uploader.destroy(user.coverImg.split("/").pop().split(".")[0]);
			}

			const uploadedResponse = await cloudinary.uploader.upload(coverImg);
			coverImg = uploadedResponse.secure_url;
		}

		user.fullName = (fullName && fullName.trim()) || user.fullName;
		if (emailChanged) {
			user.email = email.trim().toLowerCase();
			user.emailVerified = false;
		}
		user.username = (username && username.trim()) || user.username;
		// an empty string clears the field; leaving it out keeps the old value
		user.bio = typeof bio === "string" ? bio : user.bio;
		user.link = cleanLink !== undefined ? cleanLink : user.link;
		user.profileImg = profileImg || user.profileImg;
		user.coverImg = coverImg || user.coverImg;

		user = await user.save();

		// changing the password signs out other devices; keep this one signed in
		if (passwordChanged) generateTokenAndSetCookie(user._id, res);
		if (emailChanged) sendVerificationEmail(user).catch((e) => console.log("verification email failed:", e.message));

		const safe = user.toObject();
		for (const k of ["password", "verifyTokenHash", "verifyTokenExpires", "resetTokenHash", "resetTokenExpires"]) {
			delete safe[k];
		}
		return res.status(200).json(safe);
	} catch (error) {
		console.log("Error in updateUser: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
