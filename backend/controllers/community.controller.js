import mongoose from "mongoose";
import Community from "../models/community.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { COMMUNITY_CATEGORIES } from "../lib/constants.js";
import { escapeRegex } from "../lib/utils/findUser.js";
import { roleOf, canModerate, slugify } from "../lib/utils/communities.js";

const PUBLIC_FIELDS = "username fullName profileImg";
const PAGE_SIZE = 20;

const cleanRules = (rules) =>
	(Array.isArray(rules) ? rules : [])
		.filter((r) => typeof r === "string")
		.map((r) => r.trim().slice(0, 200))
		.filter(Boolean)
		.slice(0, 10);

const summary = (c, userId) => ({
	_id: c._id,
	name: c.name,
	slug: c.slug,
	description: c.description,
	category: c.category,
	privacy: c.privacy,
	memberCount: c.members.length,
	role: roleOf(c, userId),
});

const findBySlug = async (req, res) => {
	const community = await Community.findOne({ slug: String(req.params.slug).toLowerCase() });
	if (!community) {
		res.status(404).json({ error: "Community not found" });
		return null;
	}
	return community;
};

export const createCommunity = async (req, res) => {
	try {
		const name = String(req.body.name ?? "").trim();
		if (name.length < 3 || name.length > 40) {
			return res.status(400).json({ error: "Name must be 3 to 40 characters" });
		}
		const slug = slugify(name);
		if (slug.length < 3) return res.status(400).json({ error: "Please use letters or numbers in the name" });

		const description = String(req.body.description ?? "").trim().slice(0, 300);
		const category = COMMUNITY_CATEGORIES.includes(req.body.category) ? req.body.category : "other";
		const privacy = req.body.privacy === "request" ? "request" : "open";

		// one person can own at most 10 communities
		if ((await Community.countDocuments({ owner: req.user._id })) >= 10) {
			return res.status(400).json({ error: "You can own up to 10 communities" });
		}
		if (await Community.exists({ slug })) {
			return res.status(400).json({ error: "A community with this name already exists" });
		}

		const community = await Community.create({
			name,
			slug,
			description,
			category,
			privacy,
			rules: cleanRules(req.body.rules),
			owner: req.user._id,
			members: [req.user._id],
		});
		res.status(201).json(summary(community, req.user._id));
	} catch (error) {
		console.log("Error in createCommunity: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const listCommunities = async (req, res) => {
	try {
		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const query = {};
		const q = String(req.query.q ?? "").trim().slice(0, 40);
		if (q) {
			const regex = new RegExp(escapeRegex(q), "i");
			query.$or = [{ name: regex }, { description: regex }];
		}
		if (COMMUNITY_CATEGORIES.includes(req.query.category)) query.category = req.query.category;

		const rows = await Community.find(query)
			.sort({ createdAt: -1 })
			.skip((page - 1) * PAGE_SIZE)
			.limit(PAGE_SIZE + 1);

		const communities = rows.slice(0, PAGE_SIZE).map((c) => summary(c, req.user._id));
		// biggest first within the page, so active communities are easy to spot
		communities.sort((a, b) => b.memberCount - a.memberCount);
		res.status(200).json({ communities, hasMore: rows.length > PAGE_SIZE });
	} catch (error) {
		console.log("Error in listCommunities: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const myCommunities = async (req, res) => {
	try {
		const rows = await Community.find({ members: req.user._id }).sort({ name: 1 });
		res.status(200).json(rows.map((c) => summary(c, req.user._id)));
	} catch (error) {
		console.log("Error in myCommunities: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getCommunity = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;

		const base = summary(community, req.user._id); // computed before ids are replaced by people
		const isMod = base.role === "owner" || base.role === "moderator";

		await community.populate([
			{ path: "owner", select: PUBLIC_FIELDS },
			{ path: "moderators", select: PUBLIC_FIELDS },
		]);

		res.status(200).json({
			...base,
			rules: community.rules,
			owner: community.owner,
			moderators: community.moderators,
			pendingCount: isMod ? community.pending.length : undefined,
			createdAt: community.createdAt,
		});
	} catch (error) {
		console.log("Error in getCommunity: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const joinCommunity = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		const me = req.user._id;
		const role = roleOf(community, me);

		if (role !== "none" && role !== "pending") return res.status(200).json({ role });

		if (community.privacy === "open") {
			await Community.updateOne({ _id: community._id }, { $addToSet: { members: me }, $pull: { pending: me } });
			return res.status(200).json({ role: "member" });
		}
		await Community.updateOne({ _id: community._id }, { $addToSet: { pending: me } });
		res.status(200).json({ role: "pending" });
	} catch (error) {
		console.log("Error in joinCommunity: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// leave the community, or cancel a join request
export const leaveCommunity = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		const me = req.user._id;

		if (community.owner.equals(me)) {
			return res.status(400).json({ error: "The owner can't leave. Delete the community or hand it over first." });
		}
		await Community.updateOne({ _id: community._id }, { $pull: { members: me, moderators: me, pending: me } });
		res.status(200).json({ role: "none" });
	} catch (error) {
		console.log("Error in leaveCommunity: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getMembers = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		const role = roleOf(community, req.user._id);
		if (community.privacy === "request" && !["owner", "moderator", "member"].includes(role)) {
			return res.status(403).json({ error: "Only members can see the member list" });
		}

		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const ids = community.members.slice().reverse(); // newest members first
		const slice = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
		const users = await User.find({ _id: { $in: slice } }).select(PUBLIC_FIELDS);
		const byId = new Map(users.map((u) => [u._id.toString(), u]));

		const members = slice
			.map((id) => byId.get(id.toString()))
			.filter(Boolean)
			.map((u) => ({
				...u.toObject(),
				role: roleOf(community, u._id),
			}));
		res.status(200).json({ members, hasMore: ids.length > page * PAGE_SIZE });
	} catch (error) {
		console.log("Error in getMembers: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getRequests = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		if (!canModerate(community, req.user._id)) {
			return res.status(403).json({ error: "Only moderators can see join requests" });
		}
		const users = await User.find({ _id: { $in: community.pending } }).select(PUBLIC_FIELDS);
		res.status(200).json(users);
	} catch (error) {
		console.log("Error in getRequests: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

const validUserId = (req, res) => {
	if (!mongoose.isValidObjectId(req.params.userId)) {
		res.status(404).json({ error: "User not found" });
		return null;
	}
	return req.params.userId;
};

export const decideRequest = (approve) => async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		if (!canModerate(community, req.user._id)) {
			return res.status(403).json({ error: "Only moderators can answer join requests" });
		}
		const userId = validUserId(req, res);
		if (!userId) return;
		if (!community.pending.some((id) => id.toString() === userId)) {
			return res.status(404).json({ error: "No such join request" });
		}

		await Community.updateOne(
			{ _id: community._id },
			approve ? { $pull: { pending: userId }, $addToSet: { members: userId } } : { $pull: { pending: userId } }
		);
		res.status(200).json({ approved: approve });
	} catch (error) {
		console.log("Error in decideRequest: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const removeMember = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		const myRole = roleOf(community, req.user._id);
		if (myRole !== "owner" && myRole !== "moderator") {
			return res.status(403).json({ error: "Only moderators can remove members" });
		}
		const userId = validUserId(req, res);
		if (!userId) return;

		const targetRole = roleOf(community, userId);
		if (targetRole === "owner") return res.status(400).json({ error: "The owner can't be removed" });
		if (targetRole === "moderator" && myRole !== "owner") {
			return res.status(403).json({ error: "Only the owner can remove a moderator" });
		}
		await Community.updateOne({ _id: community._id }, { $pull: { members: userId, moderators: userId } });
		res.status(200).json({ removed: true });
	} catch (error) {
		console.log("Error in removeMember: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const toggleModerator = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		if (!community.owner.equals(req.user._id)) {
			return res.status(403).json({ error: "Only the owner can manage moderators" });
		}
		const userId = validUserId(req, res);
		if (!userId) return;

		const role = roleOf(community, userId);
		if (role === "owner") return res.status(400).json({ error: "The owner is already in charge" });
		if (role === "none" || role === "pending") {
			return res.status(400).json({ error: "Only members can become moderators" });
		}

		const isMod = role === "moderator";
		await Community.updateOne(
			{ _id: community._id },
			isMod ? { $pull: { moderators: userId } } : { $addToSet: { moderators: userId } }
		);
		res.status(200).json({ moderator: !isMod });
	} catch (error) {
		console.log("Error in toggleModerator: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const updateCommunity = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		if (!community.owner.equals(req.user._id)) {
			return res.status(403).json({ error: "Only the owner can change community settings" });
		}

		if (typeof req.body.description === "string") community.description = req.body.description.trim().slice(0, 300);
		if (req.body.rules !== undefined) community.rules = cleanRules(req.body.rules);
		if (COMMUNITY_CATEGORIES.includes(req.body.category)) community.category = req.body.category;
		if (["open", "request"].includes(req.body.privacy)) community.privacy = req.body.privacy;
		await community.save();

		res.status(200).json(summary(community, req.user._id));
	} catch (error) {
		console.log("Error in updateCommunity: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const deleteCommunity = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		if (!community.owner.equals(req.user._id)) {
			return res.status(403).json({ error: "Only the owner can delete the community" });
		}
		// the community's posts are deleted with it
		await Post.deleteMany({ community: community._id });
		await Community.deleteOne({ _id: community._id });
		res.status(200).json({ message: "Community deleted" });
	} catch (error) {
		console.log("Error in deleteCommunity: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const togglePin = async (req, res) => {
	try {
		const community = await findBySlug(req, res);
		if (!community) return;
		if (!canModerate(community, req.user._id)) {
			return res.status(403).json({ error: "Only moderators can pin posts" });
		}
		const { postId } = req.params;
		if (!mongoose.isValidObjectId(postId)) return res.status(404).json({ error: "Post not found" });

		const post = await Post.findOne({ _id: postId, community: community._id }).select("_id");
		if (!post) return res.status(404).json({ error: "That post isn't in this community" });

		const alreadyPinned = community.pinnedPost?.equals(post._id);
		community.pinnedPost = alreadyPinned ? undefined : post._id;
		await community.save();
		res.status(200).json({ pinned: !alreadyPinned });
	} catch (error) {
		console.log("Error in togglePin: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
