import crypto from "crypto";
import ServerKey from "../../models/serverKey.model.js";
import PushSubscription from "../../models/pushSubscription.model.js";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

// Create the signing keys once, keep them in the database, reuse them forever.
let keysPromise = null;
export const getVapidKeys = () => {
	if (!keysPromise) {
		keysPromise = (async () => {
			let row = await ServerKey.findOne({ name: "vapid" });
			if (!row) {
				const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
				const pub = publicKey.export({ format: "jwk" });
				const priv = privateKey.export({ format: "jwk" });
				const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
				try {
					row = await ServerKey.create({ name: "vapid", publicKey: b64url(raw), privateKey: priv.d });
				} catch {
					row = await ServerKey.findOne({ name: "vapid" }); // another instance won the race
				}
			}
			return { publicKey: row.publicKey, privateKey: row.privateKey };
		})().catch((e) => {
			keysPromise = null;
			throw e;
		});
	}
	return keysPromise;
};

let webpushPromise = null;
const loadWebPush = () => {
	if (!webpushPromise) {
		webpushPromise = import("web-push")
			.then(async (m) => {
				const wp = m.default || m;
				const { publicKey, privateKey } = await getVapidKeys();
				const contact = process.env.MAIL_FROM ? `mailto:${process.env.MAIL_FROM}` : "mailto:admin@example.com";
				wp.setVapidDetails(contact, publicKey, privateKey);
				return wp;
			})
			.catch((e) => {
				console.log("Push is unavailable:", e.message);
				return null;
			});
	}
	return webpushPromise;
};

// send to every device this person enabled; never throws
export const sendPush = async (userId, payload) => {
	try {
		const subs = await PushSubscription.find({ user: userId });
		if (subs.length === 0) return;
		const wp = await loadWebPush();
		if (!wp) return;
		const body = JSON.stringify(payload);
		await Promise.all(
			subs.map((s) =>
				wp.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60 * 24 }).catch(async (err) => {
					if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
					else console.log("push failed:", err.statusCode || err.message);
				})
			)
		);
	} catch (error) {
		console.log("sendPush error:", error.message);
	}
};
