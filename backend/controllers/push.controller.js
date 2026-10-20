import PushSubscription from "../models/pushSubscription.model.js";
import { getVapidKeys } from "../lib/utils/push.js";

export const publicKey = async (req, res) => {
	try {
		res.status(200).json({ publicKey: (await getVapidKeys()).publicKey });
	} catch (error) {
		console.log("Error in push publicKey:", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const subscribe = async (req, res) => {
	try {
		const { endpoint, keys } = req.body || {};
		if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
			return res.status(400).json({ error: "Invalid subscription" });
		}
		if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
			return res.status(400).json({ error: "Invalid subscription" });
		}
		await PushSubscription.findOneAndUpdate(
			{ endpoint },
			{ user: req.user._id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
			{ upsert: true, new: true }
		);
		res.status(200).json({ ok: true });
	} catch (error) {
		console.log("Error in push subscribe:", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const unsubscribe = async (req, res) => {
	try {
		const endpoint = String(req.body?.endpoint ?? "");
		await PushSubscription.deleteOne({ endpoint, user: req.user._id });
		res.status(200).json({ ok: true });
	} catch (error) {
		console.log("Error in push unsubscribe:", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
