import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { createReport, listReports, resolveReport } from "../controllers/report.controller.js";

const router = express.Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: "Too many reports. Please slow down." });

router.post("/", limiter, protectRoute, createReport);
router.get("/", protectRoute, requireAdmin, listReports);
router.post("/:id/resolve", protectRoute, requireAdmin, resolveReport);

export default router;
