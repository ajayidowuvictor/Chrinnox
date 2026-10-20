import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { findUserByUsername } from "../lib/utils/findUser.js";
import { isBlockedBetween, buildFeedFilter } from "../lib/utils/relations.js";
import { extractTopics, normalizeTopic, isValidTopic } from "../lib/utils/topics.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Community from "../models/community.model.js";
import Collection from "../models/collection.model.js";
import { OPPORTUNITY_KINDS, POST_TYPES } from "../lib/constants.js";
import { escapeRegex } from "../lib/utils/findUser.js";
import {
	buildCommunityVisibility,
	canModerate,
	getMyCommunityIds,
	getRestrictedCommunityIds,
	roleOf,
} from "../lib/utils/communities.js";

const MAX_POST_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;
const MAX_IMAGES = 4;
const FEED_LIMIT = 100; // newest posts shown per feed

export const createPost = async (req, res) => {
	try {
		const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
		const userId = req.user._id.toString();

		// accept a list of images ("imgs") or a single one ("img")
		let images = Array.isArray(req.body.imgs) ? req.body.imgs : req.body.img ? [req.body.img] : [];
		images = images.filter(Boolean);

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if (!text && images.length === 0) {
			return res.status(400).json({ error: "Post must have text or image" });
		}
		const type = POST_TYPES.includes(req.body.type) ? req.body.type : "post";

		let community = null;
		if (req.body.communitySlug) {
			community = await Community.findOne({ slug: String(req.body.communitySlug).toLowerCase() });
			if (!community) return res.status(404).json({ error: "Community not found" });
			if (!["owner", "moderator", "member"].includes(roleOf(community, userId))) {
				return res.status(403).json({ error: "Join this community to post in it" });
			}
		}
		if (type === "announcement" && !(community && canModerate(community, userId))) {
			return res.status(400).json({ error: "Announcements can only be posted by community moderators" });
		}
		if ((type === "question" || type === "opportunity") && !text) {
			return res.status(400).json({ error: "Please describe it in the text box" });
		}

		let opportunity;
		if (type === "opportunity") {
			const o = req.body.opportunity || {};
			if (!OPPORTUNITY_KINDS.includes(o.kind)) {
				return res.status(400).json({ error: "Choose what kind of opportunity this is" });
			}
			const location = String(o.location ?? "").trim().slice(0, 80);
			const link = String(o.link ?? "").trim();
			if (link && (link.length > 300 || !/^https?:\/\/\S+$/i.test(link))) {
				return res.status(400).json({ error: "The link must start with http:// or https://" });
			}
			let deadline;
			if (o.deadline) {
				deadline = new Date(o.deadline);
				if (Number.isNaN(deadline.getTime())) return res.status(400).json({ error: "Invalid deadline" });
				if (deadline.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
					return res.status(400).json({ error: "The deadline can't be in the past" });
				}
			}
			opportunity = { kind: o.kind, location: location || undefined, link: link || undefined, deadline };
		}

		if (images.length > MAX_IMAGES) {
			return res.status(400).json({ error: `You can attach at most ${MAX_IMAGES} photos` });
		}
		if (text.length > MAX_POST_LENGTH) {
			return res.status(400).json({ error: `Posts can be at most ${MAX_POST_LENGTH} characters` });
		}

		if (images.some((i) => typeof i !== "string" || !i.startsWith("data:image/"))) {
			return res.status(400).json({ error: "Only image files can be attached" });
		}

		let urls = [];
		if (images.length > 0) {
			try {
				const uploads = await Promise.all(images.map((i) => cloudinary.uploader.upload(i)));
				urls = uploads.map((u) => u.secure_url);
			} catch (uploadError) {
				console.log("Cloudinary upload failed: ", uploadError.message);
				return res.status(400).json({ error: "Image upload failed. Try smaller images." });
			}
		}

		const newPost = new Post({
			user: userId,
			text,
			imgs: urls,
			img: urls[0], // kept so older screens still work
			topics: extractTopics(text),
			type,
			opportunity,
			community: community?._id,
		});

		await newPost.save();
		res.status(201).json(newPost);
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
		console.log("Error in createPost controller: ", error);
	}
};

export const deletePost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		let allowed = post.user.toString() === req.user._id.toString();
		if (!allowed && post.community) {
			const community = await Community.findById(post.community);
			allowed = !!community && canModerate(community, req.user._id);
		}
		if (!allowed) {
			return res.status(401).json({ error: "You are not authorized to delete this post" });
		}

		const allImages = [...new Set([...(post.imgs || []), ...(post.img ? [post.img] : [])])];
		for (const url of allImages) {
			try {
				const imgId = url.split("/").pop().split(".")[0];
				await cloudinary.uploader.destroy(imgId);
			} catch (destroyError) {
				console.log("Could not delete image from Cloudinary: ", destroyError.message);
			}
		}

		await Post.findByIdAndDelete(req.params.id);
		await Collection.updateMany({ posts: post._id }, { $pull: { posts: post._id } });
		await Community.updateOne({ pinnedPost: post._id }, { $unset: { pinnedPost: 1 } });

		res.status(200).json({ message: "Post deleted successfully" });
	} catch (error) {
		console.log("Error in deletePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const commentOnPost = async (req, res) => {
	try {
		const { text } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;

		if (typeof text !== "string" || !text.trim()) {
			return res.status(400).json({ error: "Text field is required" });
		}
		if (text.trim().length > MAX_COMMENT_LENGTH) {
			return res.status(400).json({ error: `Comments can be at most ${MAX_COMMENT_LENGTH} characters` });
		}
		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// the post author decides who may reply (enforced here, never on the client)
		if (post.user.toString() !== userId.toString()) {
			if (await isBlockedBetween(userId, post.user)) {
				return res.status(403).json({ error: "You can't reply to this post" });
			}
			const author = await User.findById(post.user).select("settings following");
			const policy = author?.settings?.whoCanReply || "everyone";
			if (policy === "nobody") {
				return res.status(403).json({ error: "The author has turned replies off for this post" });
			}
			if (policy === "following" && !author.following.some((id) => id.equals(userId))) {
				return res.status(403).json({ error: "Only people the author follows can reply" });
			}
		}

		const comment = { user: userId, text: text.trim() };

		post.comments.push(comment);
		await post.save();

		// notify the post owner (not when commenting on your own post)
		if (post.user.toString() !== userId.toString()) {
			const notification = new Notification({
				from: userId,
				to: post.user,
				type: "comment",
			});
			await notification.save();
		}

		res.status(200).json(post);
	} catch (error) {
		console.log("Error in commentOnPost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const likeUnlikePost = async (req, res) => {
	try {
		const userId = req.user._id;
		const { id: postId } = req.params;

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const userLikedPost = post.likes.includes(userId);

		if (userLikedPost) {
			// Unlike post
			await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
			await User.updateOne({ _id: userId }, { $pull: { likedPosts: postId } });

			const updatedLikes = post.likes.filter((id) => id.toString() !== userId.toString());
			res.status(200).json(updatedLikes);
		} else {
			// Like post
			post.likes.push(userId);
			await User.updateOne({ _id: userId }, { $push: { likedPosts: postId } });
			await post.save();

			const notification = new Notification({
				from: userId,
				to: post.user,
				type: "like",
			});
			await notification.save();

			const updatedLikes = post.likes;
			res.status(200).json(updatedLikes);
		}
	} catch (error) {
		console.log("Error in likeUnlikePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getAllPosts = async (req, res) => {
	try {
		const posts = await Post.find({
			$and: [await buildFeedFilter(req.user._id), await buildCommunityVisibility(req.user._id)],
		})
			.sort({ createdAt: -1 })
			.limit(FEED_LIMIT)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			})
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		if (posts.length === 0) {
			return res.status(200).json([]);
		}

		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getAllPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getLikedPosts = async (req, res) => {
	const userId = req.params.id;

	try {
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const likedPosts = await Post.find({
			$and: [{ _id: { $in: user.likedPosts } }, await buildCommunityVisibility(req.user._id)],
		})
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			})
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		res.status(200).json(likedPosts);
	} catch (error) {
		console.log("Error in getLikedPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getFollowingPosts = async (req, res) => {
	try {
		const userId = req.user._id;
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const following = user.following;

		const feedFilter = await buildFeedFilter(userId);
		const feedPosts = await Post.find({
			$and: [
				{ $or: [{ user: { $in: following } }, { reposts: { $in: following } }] },
				feedFilter,
				await buildCommunityVisibility(userId),
			],
		})
			.sort({ createdAt: -1 })
			.limit(FEED_LIMIT)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			})
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		// label posts that are here because someone you follow reposted them
		const followingSet = new Set(following.map((id) => id.toString()));
		const reposterByPost = new Map();
		feedPosts.forEach((p) => {
			if (!followingSet.has(p.user._id.toString())) {
				const reposter = p.reposts.find((id) => followingSet.has(id.toString()));
				if (reposter) reposterByPost.set(p._id.toString(), reposter.toString());
			}
		});
		const reposters = await User.find({ _id: { $in: [...new Set(reposterByPost.values())] } }).select(
			"username fullName"
		);
		const reposterMap = new Map(reposters.map((u) => [u._id.toString(), u]));

		const result = feedPosts.map((p) => {
			const obj = p.toObject();
			const reposter = reposterMap.get(reposterByPost.get(p._id.toString()));
			if (reposter) obj.repostedBy = { fullName: reposter.fullName, username: reposter.username };
			return obj;
		});

		res.status(200).json(result);
	} catch (error) {
		console.log("Error in getFollowingPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getUserPosts = async (req, res) => {
	try {
		const { username } = req.params;

		const user = await findUserByUsername(username);
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find({
			$and: [{ $or: [{ user: user._id }, { reposts: user._id }] }, await buildCommunityVisibility(req.user._id)],
		})
			.sort({ createdAt: -1 })
			.limit(FEED_LIMIT)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			})
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		const result = posts.map((p) => {
			const obj = p.toObject();
			if (p.user._id.toString() !== user._id.toString()) {
				obj.repostedBy = { fullName: user.fullName, username: user.username };
			}
			return obj;
		});

		res.status(200).json(result);
	} catch (error) {
		console.log("Error in getUserPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const repostUnrepost = async (req, res) => {
	try {
		const userId = req.user._id;
		const { id: postId } = req.params;

		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const alreadyReposted = post.reposts.some((id) => id.toString() === userId.toString());

		if (alreadyReposted) {
			await Post.updateOne({ _id: postId }, { $pull: { reposts: userId } });
			const updated = post.reposts.filter((id) => id.toString() !== userId.toString());
			return res.status(200).json(updated);
		}

		post.reposts.push(userId);
		await post.save();

		// notify the post owner (not when reposting your own post)
		if (post.user.toString() !== userId.toString()) {
			const notification = new Notification({
				from: userId,
				to: post.user,
				type: "repost",
			});
			await notification.save();
		}

		res.status(200).json(post.reposts);
	} catch (error) {
		console.log("Error in repostUnrepost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const bookmarkUnbookmark = async (req, res) => {
	try {
		const userId = req.user._id;
		const { id: postId } = req.params;

		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const user = await User.findById(userId).select("bookmarks");
		const alreadySaved = user.bookmarks.some((id) => id.toString() === postId);

		const updatedUser = await User.findByIdAndUpdate(
			userId,
			alreadySaved ? { $pull: { bookmarks: postId } } : { $addToSet: { bookmarks: postId } },
			{ new: true }
		).select("bookmarks");

		if (alreadySaved) await Collection.updateMany({ owner: userId }, { $pull: { posts: postId } });

		res.status(200).json(updatedUser.bookmarks);
	} catch (error) {
		console.log("Error in bookmarkUnbookmark controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getBookmarkedPosts = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select("bookmarks");
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find({
			$and: [{ _id: { $in: user.bookmarks } }, await buildCommunityVisibility(req.user._id)],
		})
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			})
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		// most recently saved first
		const order = user.bookmarks.map((id) => id.toString());
		posts.sort((a, b) => order.indexOf(b._id.toString()) - order.indexOf(a._id.toString()));

		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getBookmarkedPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getPostById = async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.isValidObjectId(id)) {
			return res.status(404).json({ error: "Post not found" });
		}

		const post = await Post.findById(id)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			})
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		if (post.community) {
			const restricted = await getRestrictedCommunityIds(req.user._id);
			if (restricted.some((cid) => cid.equals(post.community._id))) {
				return res.status(403).json({ error: "This post is in a members-only community" });
			}
		}

		res.status(200).json(post);
	} catch (error) {
		console.log("Error in getPostById controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// ---------------- "Helpful" signal (separate from likes) ----------------

export const helpfulUnhelpful = async (req, res) => {
	try {
		const userId = req.user._id;
		const post = await Post.findById(req.params.id);
		if (!post) return res.status(404).json({ error: "Post not found" });

		const already = post.helpful.some((id) => id.toString() === userId.toString());
		if (already) {
			await Post.updateOne({ _id: post._id }, { $pull: { helpful: userId } });
			return res.status(200).json(post.helpful.filter((id) => id.toString() !== userId.toString()));
		}

		post.helpful.push(userId);
		await post.save();

		if (post.user.toString() !== userId.toString()) {
			await new Notification({ from: userId, to: post.user, type: "helpful" }).save();
		}
		res.status(200).json(post.helpful);
	} catch (error) {
		console.log("Error in helpfulUnhelpful controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const helpfulUnhelpfulComment = async (req, res) => {
	try {
		const userId = req.user._id;
		const { postId, commentId } = req.params;
		if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(commentId)) {
			return res.status(404).json({ error: "Reply not found" });
		}

		const post = await Post.findById(postId);
		const comment = post?.comments.id(commentId);
		if (!comment) return res.status(404).json({ error: "Reply not found" });

		const already = comment.helpful.some((id) => id.toString() === userId.toString());
		if (already) {
			comment.helpful = comment.helpful.filter((id) => id.toString() !== userId.toString());
		} else {
			comment.helpful.push(userId);
		}
		await post.save();

		if (!already && comment.user.toString() !== userId.toString()) {
			await new Notification({ from: userId, to: comment.user, type: "helpful" }).save();
		}
		res.status(200).json(comment.helpful);
	} catch (error) {
		console.log("Error in helpfulUnhelpfulComment controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// ---------------- Feed modes with pages ----------------

const FEED_PAGE_SIZE = 15;
const FEED_MODES = ["forYou", "following", "latest", "discussions", "topics", "topic", "community"];

const populateFeed = (query) =>
	query
		.populate({ path: "user", select: "-password" })
		.populate({ path: "comments.user", select: "-password" })
		.populate({ path: "community", select: "name slug owner moderators privacy" });

export const getFeed = async (req, res) => {
	try {
		const meId = req.user._id;
		const mode = FEED_MODES.includes(req.query.mode) ? req.query.mode : "forYou";
		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const skip = (page - 1) * FEED_PAGE_SIZE;

		const me = await User.findById(meId).select("following followedTopics");
		const followingSet = new Set(me.following.map((id) => id.toString()));
		const topicSet = new Set(me.followedTopics || []);
		const filter = await buildFeedFilter(meId);

		// community posts only show up in a community's own feed, or in the feeds of its members
		let community = null;
		let extra;
		if (mode === "community") {
			community = await Community.findOne({ slug: String(req.query.community ?? "").toLowerCase() });
			if (!community) return res.status(404).json({ error: "Community not found" });
			if (community.privacy === "request" && !["owner", "moderator", "member"].includes(roleOf(community, meId))) {
				return res.status(403).json({ error: "Join this community to see its posts" });
			}
			extra = { community: community._id };
		} else {
			const mine = await getMyCommunityIds(meId);
			extra = { $or: [{ community: null }, { community: { $in: mine } }] };
		}

		let posts = [];
		let hasMore = false;

		// modes that the database can sort and page by itself
		const pagedFind = async (conditions, sort = { createdAt: -1 }) => {
			const rows = await populateFeed(
				Post.find({ $and: [conditions, filter, extra] })
					.sort(sort)
					.skip(skip)
					.limit(FEED_PAGE_SIZE + 1)
			);
			hasMore = rows.length > FEED_PAGE_SIZE;
			return rows.slice(0, FEED_PAGE_SIZE);
		};

		// modes that need ranking: look at the newest posts, score them, then page
		const rankedFind = async (conditions, scoreOf) => {
			const candidates = await populateFeed(
				Post.find({ $and: [conditions, filter, extra] })
					.sort({ createdAt: -1 })
					.limit(300)
			);
			const ranked = candidates
				.map((p) => ({ p, score: scoreOf(p) }))
				.sort((a, b) => b.score - a.score || b.p.createdAt - a.p.createdAt)
				.map((x) => x.p);
			hasMore = ranked.length > skip + FEED_PAGE_SIZE;
			return ranked.slice(skip, skip + FEED_PAGE_SIZE);
		};

		const hoursOld = (p) => (Date.now() - new Date(p.createdAt).getTime()) / 36e5;

		if (mode === "community") {
			posts = await pagedFind({});
			if (page === 1 && community.pinnedPost) {
				const pinned = await populateFeed(Post.findById(community.pinnedPost));
				if (pinned) posts = [pinned, ...posts.filter((p) => !p._id.equals(pinned._id))];
			}
		} else if (mode === "latest") {
			posts = await pagedFind({});
		} else if (mode === "following") {
			const following = me.following;
			posts = await pagedFind({ $or: [{ user: { $in: following } }, { reposts: { $in: following } }] });
		} else if (mode === "topics") {
			if (topicSet.size === 0) {
				return res.status(200).json({ posts: [], hasMore: false, needsTopics: true });
			}
			posts = await pagedFind({ topics: { $in: [...topicSet] } });
		} else if (mode === "topic") {
			const topic = normalizeTopic(req.query.topic);
			if (!isValidTopic(topic)) return res.status(200).json({ posts: [], hasMore: false });
			posts = await pagedFind({ topics: topic });
		} else if (mode === "discussions") {
			// conversations with the most replies, recent ones first
			posts = await rankedFind({ "comments.0": { $exists: true } }, (p) => {
				const replies = p.comments.length;
				return (replies + p.helpful.length) / Math.pow(hoursOld(p) + 2, 0.8);
			});
		} else {
			// For You: usefulness and conversation count more than raw likes, fresh posts win,
			// and people and topics you follow get a boost
			posts = await rankedFind({}, (p) => {
				let score =
					1 + p.likes.length + 2 * p.comments.length + 2 * p.reposts.length + 3 * p.helpful.length;
				if (followingSet.has(p.user._id.toString())) score *= 2;
				if ((p.topics || []).some((t) => topicSet.has(t))) score *= 1.5;
				return score / Math.pow(hoursOld(p) + 2, 1.2);
			});
		}

		// label posts that are here because someone you follow reposted them
		const result = posts.map((p) => {
			const obj = p.toObject();
			if (community?.pinnedPost && p._id.equals(community.pinnedPost)) obj.pinned = true;
			if (mode === "following" && !followingSet.has(p.user._id.toString())) {
				const reposterId = p.reposts.find((id) => followingSet.has(id.toString()));
				if (reposterId) obj._reposterId = reposterId.toString();
			}
			return obj;
		});
		const reposterIds = [...new Set(result.map((o) => o._reposterId).filter(Boolean))];
		if (reposterIds.length) {
			const reposters = await User.find({ _id: { $in: reposterIds } }).select("username fullName");
			const byId = new Map(reposters.map((u) => [u._id.toString(), u]));
			result.forEach((o) => {
				const u = byId.get(o._reposterId);
				if (u) o.repostedBy = { fullName: u.fullName, username: u.username };
				delete o._reposterId;
			});
		}

		res.status(200).json({ posts: result, hasMore, page });
	} catch (error) {
		console.log("Error in getFeed controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// ---------------- Opportunities board ----------------

export const getOpportunities = async (req, res) => {
	try {
		const meId = req.user._id;
		const page = Math.max(1, parseInt(req.query.page, 10) || 1);

		const conditions = { type: "opportunity" };
		if (OPPORTUNITY_KINDS.includes(req.query.kind)) conditions["opportunity.kind"] = req.query.kind;

		const q = String(req.query.q ?? "").trim().slice(0, 60);
		if (q) {
			const regex = new RegExp(escapeRegex(q), "i");
			conditions.$or = [{ text: regex }, { "opportunity.location": regex }];
		}

		const and = [conditions, await buildFeedFilter(meId), await buildCommunityVisibility(meId)];
		if (req.query.all !== "1") {
			// hide opportunities whose deadline has passed
			and.push({ $or: [{ "opportunity.deadline": null }, { "opportunity.deadline": { $gte: new Date() } }] });
		}

		const rows = await populateFeed(
			Post.find({ $and: and })
				.sort({ createdAt: -1 })
				.skip((page - 1) * FEED_PAGE_SIZE)
				.limit(FEED_PAGE_SIZE + 1)
		);
		res.status(200).json({
			posts: rows.slice(0, FEED_PAGE_SIZE).map((p) => p.toObject()),
			hasMore: rows.length > FEED_PAGE_SIZE,
			page,
		});
	} catch (error) {
		console.log("Error in getOpportunities controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// ---------------- Questions: best answer ----------------

export const acceptAnswer = async (req, res) => {
	try {
		const userId = req.user._id;
		const { id, commentId } = req.params;
		if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(commentId)) {
			return res.status(404).json({ error: "Reply not found" });
		}

		const post = await Post.findById(id);
		if (!post) return res.status(404).json({ error: "Post not found" });
		if (post.type !== "question") return res.status(400).json({ error: "Only questions have a best answer" });
		if (post.user.toString() !== userId.toString()) {
			return res.status(403).json({ error: "Only the person who asked can choose the best answer" });
		}

		const comment = post.comments.id(commentId);
		if (!comment) return res.status(404).json({ error: "Reply not found" });

		const same = post.acceptedComment && post.acceptedComment.equals(comment._id);
		post.acceptedComment = same ? undefined : comment._id;
		await post.save();

		if (!same && comment.user.toString() !== userId.toString()) {
			await new Notification({ from: userId, to: comment.user, type: "accepted" }).save();
		}
		res.status(200).json({ acceptedComment: post.acceptedComment ?? null });
	} catch (error) {
		console.log("Error in acceptAnswer controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const editPost = async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Post not found" });
		const post = await Post.findById(id);
		if (!post) return res.status(404).json({ error: "Post not found" });
		if (post.user.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "You can only edit your own posts" });
		}

		const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
		const hasImages = (post.imgs || []).length > 0 || !!post.img;
		if (!text && (!hasImages || post.type !== "post")) {
			return res.status(400).json({ error: "Post can't be empty" });
		}
		if (text.length > MAX_POST_LENGTH) {
			return res.status(400).json({ error: `Posts can be at most ${MAX_POST_LENGTH} characters` });
		}
		if (text === (post.text || "")) return res.status(200).json({ text: post.text, topics: post.topics, editedAt: post.editedAt });

		post.text = text;
		post.topics = extractTopics(text);
		post.editedAt = new Date();
		await post.save();

		res.status(200).json({ text: post.text, topics: post.topics, editedAt: post.editedAt });
	} catch (error) {
		console.log("Error in editPost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const deleteComment = async (req, res) => {
	try {
		const { id, commentId } = req.params;
		if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(commentId)) {
			return res.status(404).json({ error: "Reply not found" });
		}
		const post = await Post.findById(id);
		if (!post) return res.status(404).json({ error: "Post not found" });
		const comment = post.comments.id(commentId);
		if (!comment) return res.status(404).json({ error: "Reply not found" });

		const me = req.user._id.toString();
		let allowed = comment.user.toString() === me || post.user.toString() === me;
		if (!allowed && post.community) {
			const community = await Community.findById(post.community);
			allowed = !!community && canModerate(community, me);
		}
		if (!allowed) return res.status(403).json({ error: "You can't delete this reply" });

		comment.deleteOne();
		if (post.acceptedComment && post.acceptedComment.toString() === commentId) post.acceptedComment = undefined;
		await post.save();

		res.status(200).json({ deleted: true });
	} catch (error) {
		console.log("Error in deleteComment controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
