// Topics are hashtags (#football) found in a post's text.
export const extractTopics = (text) => {
	const found = new Set();
	for (const match of String(text ?? "").matchAll(/#([\p{L}\p{N}_]{2,30})/gu)) {
		found.add(match[1].toLowerCase());
		if (found.size >= 5) break; // at most 5 topics per post
	}
	return [...found];
};

export const normalizeTopic = (name) =>
	String(name ?? "")
		.trim()
		.replace(/^#/, "")
		.toLowerCase()
		.slice(0, 30);

export const isValidTopic = (name) => /^[\p{L}\p{N}_]{2,30}$/u.test(name);
