import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { cancelEvent, createEvent, deleteEvent, getEvent, listEvents, rsvp } from "../controllers/event.controller.js";

const router = express.Router();
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "You are creating events too fast. Please try again later." });

router.get("/", protectRoute, listEvents);
router.post("/", createLimiter, protectRoute, createEvent);
router.get("/:id", protectRoute, getEvent);
router.post("/:id/rsvp", protectRoute, rsvp);
router.post("/:id/cancel", protectRoute, cancelEvent);
router.delete("/:id", protectRoute, deleteEvent);

export default router;
