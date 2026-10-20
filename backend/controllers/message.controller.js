import Message from "../models/message.model.js";
import Post from "../models/post.model.js";
import { isBlockedBetween } from "../lib/utils/relations.js";
import { findUserByUsername } from "../lib/utils/findUser.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

const PUBLIC_FIELDS = "username fullName profileImg";

// list of people you have chatted with, latest message first
export const getConversations = async (req, res) => {
	try {
		const me = req.user._id;

		const messages = await Message.find({ $or: [{ from: me }, { to: me }] })
			.sort({ createdAt: -1 })
			.limit(500)
			.populate({ path: "from", select: PUBLIC_FIELDS })
			.populate({ path: "to", select: PUBLIC_FIELDS });

		const conversations = new Map();
		for (const m of messages) {
			if (!m.from || !m.to) continue; // skip messages of deleted users
			const fromMe = m.from._id.equals(me);
			const other = fromMe ? m.to : m.from;
			const key = other._id.toString();

			if (!conversations.has(key)) {
				conversations.set(key, {
					user: other,
					lastMessage: {
						text: m.text || (m.img ? "📷 Photo" : "Shared a post"),
						createdAt: m.createdAt,
						fromMe,
					},
					unread: 0,
				});
			}
			if (!fromMe && !m.read) conversations.get(key).unread += 1;
		}

		res.status(200).json([...conversations.values()]);
	} catch (error) {
		console.log("Error in getConversations controller: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// the chat with one person; also marks their messages to you as read
export const getMessages = async (req, res) => {
	try {
		const me = req.user._id;
		const other = await findUserByUsername(req.params.username).select(PUBLIC_FIELDS);
		if (!other) return res.status(404).json({ error: "User not found" });

		const latest = await Message.find({
			$or: [
				{ from: me, to: other._id },
				{ from: other._id, to: me },
			],
		})
			.sort({ createdAt: -1 })
			.limit(200)
			.populate({
				path: "post",
				select: "text img imgs user",
				populate: { path: "user", select: PUBLIC_FIELDS },
			});

		await Message.updateMany({ from: other._id, to: me, read: false }, { read: true });

		res.status(200).json({ user: other, messages: latest.reverse() });
	} catch (error) {
		console.log("Error in getMessages controller: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const sendMessage = async (req, res) => {
	try {
		const me = req.user._id;
		const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
		let img = req.body.img;
		const { postId } = req.body;

		if (!text && !img && !postId) return res.status(400).json({ error: "Message cannot be empty" });
		if (text.length > 1000) return res.status(400).json({ error: "Message is too long (max 1000 characters)" });

		const other = await findUserByUsername(req.params.username).select("_id settings following");
		if (!other) return res.status(404).json({ error: "User not found" });
		if (other._id.equals(me)) return res.status(400).json({ error: "You can't message yourself" });

		if (await isBlockedBetween(me, other._id)) {
			return res.status(403).json({ error: "You can't message this person" });
		}
		const policy = other.settings?.whoCanMessage || "everyone";
		if (policy === "nobody") {
			return res.status(403).json({ error: "This person isn't accepting messages" });
		}
		if (policy === "following" && !other.following.some((id) => id.equals(me))) {
			return res.status(403).json({ error: "This person only accepts messages from people they follow" });
		}

		if (img) {
			if (typeof img !== "string" || !img.startsWith("data:image/")) {
				return res.status(400).json({ error: "Only image files can be sent" });
			}
			try {
				const uploaded = await cloudinary.uploader.upload(img);
				img = uploaded.secure_url;
			} catch (uploadError) {
				console.log("Cloudinary upload failed: ", uploadError.message);
				return res.status(400).json({ error: "Photo upload failed. Try a smaller photo." });
			}
		}

		let post = null;
		if (postId) {
			if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ error: "Invalid post" });
			post = await Post.findById(postId).select("_id");
			if (!post) return res.status(404).json({ error: "That post no longer exists" });
		}

		const message = await Message.create({
			from: me,
			to: other._id,
			text,
			img: img || undefined,
			post: post?._id,
			isPostShare: !!post,
		});
		res.status(201).json(message);
	} catch (error) {
		console.log("Error in sendMessage controller: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getUnreadCount = async (req, res) => {
	try {
		const count = await Message.countDocuments({ to: req.user._id, read: false });
		res.status(200).json({ count });
	} catch (error) {
		console.log("Error in getUnreadCount controller: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
