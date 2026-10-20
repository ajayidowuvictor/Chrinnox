// "dark" | "light" | "system"; remembered on this device
const KEY = "chrinnox-theme";
const DARK = "black";
const LIGHT = "chrinnox-light";

export const getThemePreference = () => {
	try {
		const v = localStorage.getItem(KEY);
		return v === "light" || v === "system" ? v : "dark";
	} catch {
		return "dark";
	}
};

const resolve = (pref) => {
	if (pref === "system") {
		return window.matchMedia?.("(prefers-color-scheme: light)").matches ? LIGHT : DARK;
	}
	return pref === "light" ? LIGHT : DARK;
};

export const applyTheme = (pref = getThemePreference()) => {
	const theme = resolve(pref);
	document.documentElement.setAttribute("data-theme", theme);
	document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === LIGHT ? "#ffffff" : "#000000");
};

export const setThemePreference = (pref) => {
	try {
		localStorage.setItem(KEY, pref);
	} catch {
		/* storage may be blocked; the choice then lasts only until reload */
	}
	applyTheme(pref);
};

// follow the device setting live while "system" is chosen
export const watchSystemTheme = () => {
	const mq = window.matchMedia?.("(prefers-color-scheme: light)");
	if (!mq) return;
	mq.addEventListener("change", () => {
		if (getThemePreference() === "system") applyTheme("system");
	});
};
