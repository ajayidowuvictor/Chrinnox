// Chrome/Android fires "beforeinstallprompt" once, early; keep it so Settings can use it later.
let deferred = null;
const listeners = new Set();

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault();
	deferred = e;
	listeners.forEach((fn) => fn());
});
window.addEventListener("appinstalled", () => {
	deferred = null;
	listeners.forEach((fn) => fn());
});

export const canPromptInstall = () => !!deferred;
export const subscribeInstall = (fn) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};
export const promptInstall = async () => {
	if (!deferred) return false;
	deferred.prompt();
	const { outcome } = await deferred.userChoice;
	deferred = null;
	listeners.forEach((fn) => fn());
	return outcome === "accepted";
};

export const isInstalled = () =>
	window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
