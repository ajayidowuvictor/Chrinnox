import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { findUserByUsername } from "../lib/utils/findUser.js";
import { isBlockedBetween, buildFeedFilter } from "../lib/utils/relations.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

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

		if (post.user.toString() !== req.user._id.toString()) {
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
		const posts = await Post.find(await buildFeedFilter(req.user._id))
			.sort({ createdAt: -1 })
			.limit(FEED_LIMIT)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

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

		const likedPosts = await Post.find({ _id: { $in: user.likedPosts } })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

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
			$and: [{ $or: [{ user: { $in: following } }, { reposts: { $in: following } }] }, feedFilter],
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
			});

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

		const posts = await Post.find({ $or: [{ user: user._id }, { reposts: user._id }] })
			.sort({ createdAt: -1 })
			.limit(FEED_LIMIT)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

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

		const posts = await Post.find({ _id: { $in: user.bookmarks } })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

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
			});

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		res.status(200).json(post);
	} catch (error) {
		console.log("Error in getPostById controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
