import { isAdmin } from "../lib/utils/admin.js";

export const requireAdmin = (req, res, next) => {
	if (!isAdmin(req.user)) return res.status(403).json({ error: "Admins only" });
	next();
};
