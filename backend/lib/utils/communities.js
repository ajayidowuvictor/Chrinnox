import Community from "../../models/community.model.js";

export const getMyCommunityIds = async (meId) =>
	(await Community.find({ members: meId }).select("_id")).map((c) => c._id);

// communities whose posts this person may NOT read (members-only communities they haven't joined)
export const getRestrictedCommunityIds = async (meId) =>
	(await Community.find({ privacy: "request", members: { $ne: meId } }).select("_id")).map((c) => c._id);

// MongoDB filter that keeps members-only community posts away from non-members
export const buildCommunityVisibility = async (meId) => {
	const restricted = await getRestrictedCommunityIds(meId);
	return restricted.length ? { community: { $nin: restricted } } : {};
};

export const roleOf = (community, userId) => {
	const id = userId.toString();
	if (community.owner.toString() === id) return "owner";
	if (community.moderators.some((m) => m.toString() === id)) return "moderator";
	if (community.members.some((m) => m.toString() === id)) return "member";
	if (community.pending.some((m) => m.toString() === id)) return "pending";
	return "none";
};

export const canModerate = (community, userId) => ["owner", "moderator"].includes(roleOf(community, userId));

export const slugify = (name) =>
	String(name)
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
