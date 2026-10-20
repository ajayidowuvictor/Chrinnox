import mongoose from "mongoose";
import { OPPORTUNITY_KINDS, POST_TYPES } from "../lib/constants.js";

const postSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		text: {
			type: String,
		},
		img: {
			type: String,
		},
		imgs: [
			{
				type: String,
			},
		],
		likes: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		type: {
			type: String,
			enum: POST_TYPES,
			default: "post",
		},
		// extra details for "opportunity" posts
		opportunity: {
			kind: { type: String, enum: OPPORTUNITY_KINDS },
			location: { type: String, maxLength: 80 },
			link: { type: String, maxLength: 300 },
			deadline: { type: Date },
		},
		community: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Community",
		},
		// for "question" posts: the reply the asker chose as the best answer
		acceptedComment: {
			type: mongoose.Schema.Types.ObjectId,
		},
		editedAt: {
			type: Date,
		},
		topics: [
			{
				type: String,
			},
		],
		helpful: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		reposts: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		comments: [
			{
				text: {
					type: String,
					required: true,
				},
				user: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
				helpful: [
					{
						type: mongoose.Schema.Types.ObjectId,
						ref: "User",
					},
				],
			},
		],
	},
	{ timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

export default Post;
