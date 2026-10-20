import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
	{
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		name: { type: String, required: true, trim: true, maxlength: 40 },
		posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
	},
	{ timestamps: true }
);

export default mongoose.model("Collection", collectionSchema);
