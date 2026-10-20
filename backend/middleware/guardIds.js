import mongoose from "mongoose";

// Rejects malformed ids in the URL up front (clean 404 instead of a server error).
export const guardIds = (router, ...names) => {
	for (const name of names) {
		router.param(name, (req, res, next, value) => {
			if (mongoose.isValidObjectId(value)) return next();
			res.status(404).json({ error: "Not found" });
		});
	}
};
