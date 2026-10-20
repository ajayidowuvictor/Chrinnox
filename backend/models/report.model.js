import mongoose from "mongoose";

export const REPORT_REASONS = ["spam", "harassment", "hate", "scam", "nudity", "violence", "misinformation", "other"];

const reportSchema = new mongoose.Schema(
	{
		reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		targetType: { type: String, enum: ["post", "user"], required: true },
		post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // the reported person (also the post's author for post reports)
		reason: { type: String, enum: REPORT_REASONS, required: true },
		details: { type: String, maxlength: 500, default: "" },
		status: { type: String, enum: ["open", "resolved", "dismissed"], default: "open" },
		action: { type: String, default: "" },
		resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true }
);

// one open report per reporter per target
reportSchema.index({ reporter: 1, post: 1, user: 1, status: 1 });

export default mongoose.model("Report", reportSchema);
