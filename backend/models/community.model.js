import mongoose from "mongoose";
import { COMMUNITY_CATEGORIES } from "../lib/constants.js";

const communitySchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true, minLength: 3, maxLength: 40 },
		slug: { type: String, required: true, unique: true, lowercase: true },
		description: { type: String, default: "", maxLength: 300 },
		category: { type: String, enum: COMMUNITY_CATEGORIES, default: "other" },
		// open: anyone can join and read. request: people ask to join, only members can read.
		privacy: { type: String, enum: ["open", "request"], default: "open" },
		rules: [{ type: String, maxLength: 200 }],
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		pending: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		pinnedPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
	},
	{ timestamps: true }
);

communitySchema.index({ members: 1 });

const Community = mongoose.model("Community", communitySchema);

export default Community;
