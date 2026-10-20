import User from "../../models/user.model.js";
import { escapeRegex } from "./findUser.js";

// true if either person has blocked the other
export const isBlockedBetween = async (aId, bId) =>
	!!(await User.exists({
		$or: [
			{ _id: aId, blockedUsers: bId },
			{ _id: bId, blockedUsers: aId },
		],
	}));

// ids of everyone whose posts should be hidden from this person's feeds:
// people they muted, people they blocked, and people who blocked them
export const getHiddenUserIds = async (meId) => {
	const me = await User.findById(meId).select("mutedUsers blockedUsers");
	const blockedMe = await User.find({ blockedUsers: meId }).select("_id");
	return [...(me?.mutedUsers || []), ...(me?.blockedUsers || []), ...blockedMe.map((u) => u._id)];
};

// MongoDB filter that applies a person's mutes, blocks and muted words to a feed
export const buildFeedFilter = async (meId) => {
	const me = await User.findById(meId).select("mutedWords");
	const hidden = await getHiddenUserIds(meId);
	const filter = {};
	if (hidden.length) filter.user = { $nin: hidden };
	if (me?.mutedWords?.length) {
		filter.text = { $not: new RegExp(me.mutedWords.map(escapeRegex).join("|"), "i") };
	}
	return filter;
};
