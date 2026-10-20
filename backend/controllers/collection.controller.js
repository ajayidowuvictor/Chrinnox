import mongoose from "mongoose";
import Collection from "../models/collection.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { buildCommunityVisibility } from "../lib/utils/communities.js";
import { escapeRegex } from "../lib/utils/findUser.js";

const MAX_COLLECTIONS = 20;
const MAX_POSTS = 500;

const mine = async (req, res) => {
	if (!mongoose.isValidObjectId(req.params.id)) {
		res.status(404).json({ error: "Collection not found" });
		return null;
	}
	const c = await Collection.findOne({ _id: req.params.id, owner: req.user._id });
	if (!c) res.status(404).json({ error: "Collection not found" });
	return c;
};

// list my collections; with ?post=ID each one says whether that post is inside
export const listCollections = async (req, res) => {
	try {
		const rows = await Collection.find({ owner: req.user._id }).sort({ name: 1 });
		const postId = String(req.query.post ?? "");
		res.status(200).json(
			rows.map((c) => ({
				_id: c._id,
				name: c.name,
				count: c.posts.length,
				hasPost: postId ? c.posts.some((p) => p.toString() === postId) : undefined,
			}))
		);
	} catch (error) {
		console.log("Error in listCollections: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const createCollection = async (req, res) => {
	try {
		const name = String(req.body.name ?? "").trim().slice(0, 40);
		if (name.length < 1) return res.status(400).json({ error: "Give the collection a name" });
		const exists = await Collection.findOne({
			owner: req.user._id,
			name: new RegExp(`^${escapeRegex(name)}$`, "i"),
		});
		if (exists) return res.status(400).json({ error: "You already have a collection with that name" });
		if ((await Collection.countDocuments({ owner: req.user._id })) >= MAX_COLLECTIONS) {
			return res.status(400).json({ error: `You can have up to ${MAX_COLLECTIONS} collections` });
		}
		const c = await Collection.create({ owner: req.user._id, name });
		res.status(201).json({ _id: c._id, name: c.name, count: 0 });
	} catch (error) {
		console.log("Error in createCollection: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const renameCollection = async (req, res) => {
	try {
		const c = await mine(req, res);
		if (!c) return;
		const name = String(req.body.name ?? "").trim().slice(0, 40);
		if (!name) return res.status(400).json({ error: "Give the collection a name" });
		const clash = await Collection.findOne({
			_id: { $ne: c._id },
			owner: req.user._id,
			name: new RegExp(`^${escapeRegex(name)}$`, "i"),
		});
		if (clash) return res.status(400).json({ error: "You already have a collection with that name" });
		c.name = name;
		await c.save();
		res.status(200).json({ _id: c._id, name: c.name, count: c.posts.length });
	} catch (error) {
		console.log("Error in renameCollection: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const deleteCollection = async (req, res) => {
	try {
		const c = await mine(req, res);
		if (!c) return;
		await c.deleteOne(); // the posts stay saved; only the folder goes
		res.status(200).json({ deleted: true });
	} catch (error) {
		console.log("Error in deleteCollection: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// put a post in / take it out of a collection (adding also saves it)
export const togglePostInCollection = async (req, res) => {
	try {
		const c = await mine(req, res);
		if (!c) return;
		const { postId } = req.params;
		if (!mongoose.isValidObjectId(postId)) return res.status(404).json({ error: "Post not found" });

		const inside = c.posts.some((p) => p.toString() === postId);
		if (inside) {
			c.posts.pull(postId);
		} else {
			const post = await Post.findById(postId).select("_id");
			if (!post) return res.status(404).json({ error: "Post not found" });
			if (c.posts.length >= MAX_POSTS) return res.status(400).json({ error: "This collection is full" });
			c.posts.push(postId);
			await User.updateOne({ _id: req.user._id }, { $addToSet: { bookmarks: postId } });
		}
		await c.save();
		const user = await User.findById(req.user._id).select("bookmarks");
		res.status(200).json({ added: !inside, bookmarks: user.bookmarks });
	} catch (error) {
		console.log("Error in togglePostInCollection: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getCollectionPosts = async (req, res) => {
	try {
		const c = await mine(req, res);
		if (!c) return;
		const posts = await Post.find({
			$and: [{ _id: { $in: c.posts } }, await buildCommunityVisibility(req.user._id)],
		})
			.populate({ path: "user", select: "-password" })
			.populate({ path: "comments.user", select: "-password" })
			.populate({ path: "community", select: "name slug owner moderators privacy" });

		const order = c.posts.map((id) => id.toString());
		posts.sort((a, b) => order.indexOf(b._id.toString()) - order.indexOf(a._id.toString()));
		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getCollectionPosts: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
