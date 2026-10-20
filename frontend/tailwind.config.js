import daisyui from "daisyui";
import daisyUIThemes from "daisyui/src/theming/themes";
/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			// these follow the active theme (see index.css)
			colors: {
				line: "var(--c-line)",
				hoverbg: "var(--c-hover)",
				surface: "var(--c-surface)",
			},
		},
	},
	plugins: [daisyui],

	daisyui: {
		themes: [
			{
				"chrinnox-light": {
					...daisyUIThemes["light"],
					primary: "rgb(29, 155, 240)",
					secondary: "rgb(239, 243, 244)",
				},
			},
			{
				black: {
					...daisyUIThemes["black"],
					primary: "rgb(29, 155, 240)",
					secondary: "rgb(24, 24, 24)",
				},
			},
		],
	},
};
