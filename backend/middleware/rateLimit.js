// Simple in-memory rate limiter (no extra packages needed).
// Limits how many requests one visitor (by IP address) can make in a time window.
export const rateLimit = ({ windowMs, max, message }) => {
	const hits = new Map(); // ip -> { count, resetAt }

	// clean up old entries every few minutes so memory never grows
	setInterval(() => {
		const now = Date.now();
		for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
	}, 5 * 60 * 1000).unref();

	return (req, res, next) => {
		const key = req.ip;
		const now = Date.now();
		const entry = hits.get(key);

		if (!entry || entry.resetAt <= now) {
			hits.set(key, { count: 1, resetAt: now + windowMs });
			return next();
		}

		entry.count += 1;
		if (entry.count > max) {
			const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
			res.set("Retry-After", String(retryAfter));
			return res.status(429).json({ error: message || "Too many requests, please try again later." });
		}
		next();
	};
};
