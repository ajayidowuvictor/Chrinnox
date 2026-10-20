import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getConversations, getMessages, getUnreadCount, sendMessage } from "../controllers/message.controller.js";

const router = express.Router();

// fixed paths first, so they are not mistaken for a username
router.get("/conversations", protectRoute, getConversations);
router.get("/unread-count", protectRoute, getUnreadCount);
router.get("/:username", protectRoute, getMessages);
const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, message: "You are sending messages too fast. Slow down a little." });
router.post("/:username", sendLimiter, protectRoute, sendMessage);

export default router;
