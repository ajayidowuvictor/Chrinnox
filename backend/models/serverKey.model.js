import mongoose from "mongoose";

// small server-owned secrets that must survive restarts (e.g. the web-push signing keys)
const schema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	publicKey: { type: String, required: true },
	privateKey: { type: String, required: true },
});

export default mongoose.model("ServerKey", schema);
