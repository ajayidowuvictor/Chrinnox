import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
	{
		host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		title: { type: String, required: true, trim: true, maxlength: 100 },
		description: { type: String, default: "", maxlength: 1000 },
		startsAt: { type: Date, required: true, index: true },
		endsAt: { type: Date },
		mode: { type: String, enum: ["in_person", "online"], default: "in_person" },
		location: { type: String, default: "", maxlength: 120 },
		link: { type: String, default: "", maxlength: 300 },
		community: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
		capacity: { type: Number, min: 1, max: 100000 },
		going: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		interested: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		cancelled: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

export default mongoose.model("Event", eventSchema);
