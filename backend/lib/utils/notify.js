import Notification from "../../models/notification.model.js";
import User from "../../models/user.model.js";
import { sendPush } from "./push.js";

export const NOTIF_TYPES = ["follow", "like", "comment", "repost", "helpful", "accepted", "message"];

const LINES = {
	follow: "started following you",
	like: "liked your post",
	comment: "replied to your post",
	repost: "reposted your post",
	helpful: "found your contribution helpful",
	accepted: "marked your reply as the best answer",
	message: "sent you a message",
};

// Records an in-app notification (not for "message") and sends a phone alert,
// unless the person switched that kind off in Settings.
export const notify = async ({ from, to, type }) => {
	try {
		if (String(from) === String(to)) return;
		const [recipient, sender] = await Promise.all([
			User.findById(to).select("notifPrefs"),
			User.findById(from).select("username"),
		]);
		if (!recipient || !sender) return;
		if (recipient.notifPrefs?.[type] === false) return;

		if (type !== "message") await Notification.create({ from, to, type });

		sendPush(to, {
			title: "Chrinnox",
			body: `@${sender.username} ${LINES[type]}`,
			url: type === "message" ? `/messages/${sender.username}` : "/notifications",
			tag: type === "message" ? `msg-${sender.username}` : undefined,
		});
	} catch (error) {
		console.log("notify error:", error.message);
	}
};
