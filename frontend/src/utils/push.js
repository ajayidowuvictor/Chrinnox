// turning phone alerts on/off for this device
const toKey = (base64) => {
	const pad = "=".repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
	"serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const currentSubscription = async () => {
	if (!pushSupported()) return null;
	const reg = await navigator.serviceWorker.ready;
	return reg.pushManager.getSubscription();
};

export const enablePush = async () => {
	const permission = await Notification.requestPermission();
	if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings and try again.");

	const keyRes = await fetch("/api/push/public-key");
	const keyData = await keyRes.json();
	if (!keyRes.ok) throw new Error(keyData.error || "Something went wrong");

	const reg = await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ||
		(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(keyData.publicKey) }));

	const res = await fetch("/api/push/subscribe", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(sub.toJSON()),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
};

export const disablePush = async () => {
	const sub = await currentSubscription();
	if (!sub) return;
	await fetch("/api/push/unsubscribe", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ endpoint: sub.endpoint }),
	});
	await sub.unsubscribe();
};
