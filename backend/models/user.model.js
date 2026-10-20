import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		suspended: { type: Boolean, default: false },
		emailVerified: { type: Boolean, default: false },
		verifyTokenHash: { type: String },
		verifyTokenExpires: { type: Date },
		resetTokenHash: { type: String },
		resetTokenExpires: { type: Date },
		passwordChangedAt: { type: Date },
		username: {
			type: String,
			required: true,
			unique: true,
		},
		fullName: {
			type: String,
			required: true,
		},
		password: {
			type: String,
			required: true,
			minLength: 6,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		followers: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		following: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		profileImg: {
			type: String,
			default: "",
		},
		coverImg: {
			type: String,
			default: "",
		},
		bio: {
			type: String,
			default: "",
		},

		link: {
			type: String,
			default: "",
		},
		mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		mutedWords: [{ type: String }],
		followedTopics: [{ type: String }],
		settings: {
			whoCanMessage: { type: String, enum: ["everyone", "following", "nobody"], default: "everyone" },
			whoCanReply: { type: String, enum: ["everyone", "following", "nobody"], default: "everyone" },
		},
		bookmarks: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Post",
			},
		],
		likedPosts: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Post",
				default: [],
			},
		],
	},
	{ timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
