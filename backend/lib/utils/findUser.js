import User from "../../models/user.model.js";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Finds a user by username, ignoring capital letters and stray spaces
// (so "Captain", "captain" and "Captain " all find the same person).
export const findUserByUsername = (username) => {
	const clean = String(username ?? "").trim();
	if (!clean) return User.findOne({ _id: null }); // matches nothing
	return User.findOne({ username: new RegExp(`^\\s*${escapeRegex(clean)}\\s*$`, "i") });
};
