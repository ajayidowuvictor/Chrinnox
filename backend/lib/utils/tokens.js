import crypto from "crypto";

// the raw token goes in the email link; only its hash is stored
export const makeToken = () => {
	const raw = crypto.randomBytes(32).toString("hex");
	return { raw, hash: hashToken(raw) };
};
export const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");
