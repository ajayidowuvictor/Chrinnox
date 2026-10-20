import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Report, { REPORT_REASONS } from "../models/report.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Community from "../models/community.model.js";

const PUBLIC = "username fullName profileImg suspended";

export const createReport = async (req, res) => {
	try {
		const { targetType, targetId, reason } = req.body;
		const details = String(req.body.details ?? "").trim().slice(0, 500);
		if (!["post", "user"].includes(targetType)) return res.status(400).json({ error: "Invalid report" });
		if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: "Please choose a reason" });
		if (!mongoose.isValidObjectId(targetId)) return res.status(404).json({ error: "Not found" });

		let doc;
		if (targetType === "post") {
			const post = await Post.findById(targetId).select("user");
			if (!post) return res.status(404).json({ error: "Post not found" });
			if (post.user.equals(req.user._id)) return res.status(400).json({ error: "You can't report your own post" });
			doc = { targetType, post: post._id, user: post.user };
		} else {
			const user = await User.findById(targetId).select("_id");
			if (!user) return res.status(404).json({ error: "User not found" });
			if (user._id.equals(req.user._id)) return res.status(400).json({ error: "You can't report yourself" });
			doc = { targetType, user: user._id };
		}

		const already = await Report.findOne({
			reporter: req.user._id,
			status: "open",
			...(doc.post ? { post: doc.post } : { user: doc.user, targetType: "user" }),
		});
		if (already) return res.status(200).json({ message: "You already reported this. We're reviewing it." });

		const openFromMe = await Report.countDocuments({
			reporter: req.user._id,
			createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
		});
		if (openFromMe >= 20) return res.status(429).json({ error: "Too many reports today. Please try again tomorrow." });

		await Report.create({ ...doc, reporter: req.user._id, reason, details });
		res.status(201).json({ message: "Thanks. Our team will review this." });
	} catch (error) {
		console.log("Error in createReport: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const listReports = async (req, res) => {
	try {
		const status = ["open", "resolved", "dismissed"].includes(req.query.status) ? req.query.status : "open";
		const rows = await Report.find({ status })
			.sort({ createdAt: -1 })
			.limit(50)
			.populate("reporter", PUBLIC)
			.populate("user", PUBLIC)
			.populate({ path: "post", select: "text img imgs type user createdAt", populate: { path: "user", select: PUBLIC } });

		// how many open reports each person has, so repeat offenders stand out
		const ids = rows.map((r) => r.user?._id).filter(Boolean);
		const counts = await Report.aggregate([
			{ $match: { user: { $in: ids }, status: "open" } },
			{ $group: { _id: "$user", n: { $sum: 1 } } },
		]);
		const countMap = new Map(counts.map((c) => [c._id.toString(), c.n]));

		res.status(200).json(
			rows.map((r) => ({
				...r.toObject(),
				postRemoved: r.targetType === "post" && !r.post,
				openAgainstUser: r.user ? countMap.get(r.user._id.toString()) || 0 : 0,
			}))
		);
	} catch (error) {
		console.log("Error in listReports: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

const removePostFully = async (postId) => {
	const post = await Post.findById(postId);
	if (!post) return;
	for (const url of new Set([...(post.imgs || []), ...(post.img ? [post.img] : [])])) {
		try {
			await cloudinary.uploader.destroy(url.split("/").pop().split(".")[0]);
		} catch (e) {
			console.log("Could not delete image from Cloudinary: ", e.message);
		}
	}
	await Post.findByIdAndDelete(postId);
	await Community.updateOne({ pinnedPost: postId }, { $unset: { pinnedPost: 1 } });
};

// action: dismiss | remove_post | suspend_user | unsuspend_user
export const resolveReport = async (req, res) => {
	try {
		const { action } = req.body;
		if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Report not found" });
		const report = await Report.findById(req.params.id);
		if (!report) return res.status(404).json({ error: "Report not found" });

		if (action === "remove_post") {
			if (!report.post) return res.status(400).json({ error: "No post to remove" });
			await removePostFully(report.post);
		} else if (action === "suspend_user" || action === "unsuspend_user") {
			if (!report.user) return res.status(400).json({ error: "No user on this report" });
			if (report.user.equals(req.user._id)) return res.status(400).json({ error: "You can't suspend yourself" });
			await User.updateOne({ _id: report.user }, { suspended: action === "suspend_user" });
		} else if (action !== "dismiss") {
			return res.status(400).json({ error: "Unknown action" });
		}

		// close every open report about the same target at once
		const sameTarget = report.post ? { post: report.post } : { user: report.user, targetType: "user" };
		await Report.updateMany(
			{ status: "open", ...sameTarget },
			{
				status: action === "dismiss" ? "dismissed" : "resolved",
				action,
				resolvedBy: req.user._id,
			}
		);
		res.status(200).json({ ok: true });
	} catch (error) {
		console.log("Error in resolveReport: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
