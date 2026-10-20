import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { normalizeTopic, isValidTopic } from "../lib/utils/topics.js";

// most-used topics in the last 7 days (real counts from real posts)
export const getTrendingTopics = async (req, res) => {
	try {
		const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const rows = await Post.aggregate([
			{ $match: { createdAt: { $gte: since }, "topics.0": { $exists: true } } },
			{ $unwind: "$topics" },
			{ $group: { _id: "$topics", count: { $sum: 1 } } },
			{ $sort: { count: -1, _id: 1 } },
			{ $limit: 10 },
		]);
		res.status(200).json(rows.map((r) => ({ topic: r._id, count: r.count })));
	} catch (error) {
		console.log("Error in getTrendingTopics: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getTopic = async (req, res) => {
	try {
		const topic = normalizeTopic(req.params.name);
		if (!isValidTopic(topic)) return res.status(404).json({ error: "Topic not found" });

		const [postCount, followerCount] = await Promise.all([
			Post.countDocuments({ topics: topic }),
			User.countDocuments({ followedTopics: topic }),
		]);
		res.status(200).json({ topic, postCount, followerCount });
	} catch (error) {
		console.log("Error in getTopic: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const followUnfollowTopic = async (req, res) => {
	try {
		const topic = normalizeTopic(req.params.name);
		if (!isValidTopic(topic)) return res.status(400).json({ error: "Invalid topic" });

		const me = await User.findById(req.user._id).select("followedTopics");
		const isFollowing = (me.followedTopics || []).includes(topic);

		if (!isFollowing && (me.followedTopics || []).length >= 50) {
			return res.status(400).json({ error: "You can follow up to 50 topics" });
		}

		const updated = await User.findByIdAndUpdate(
			me._id,
			isFollowing ? { $pull: { followedTopics: topic } } : { $addToSet: { followedTopics: topic } },
			{ new: true }
		).select("followedTopics");

		res.status(200).json({ following: !isFollowing, followedTopics: updated.followedTopics });
	} catch (error) {
		console.log("Error in followUnfollowTopic: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
