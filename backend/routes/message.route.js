import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { getConversations, getMessages, getUnreadCount, sendMessage } from "../controllers/message.controller.js";

const router = express.Router();

// fixed paths first, so they are not mistaken for a username
router.get("/conversations", protectRoute, getConversations);
router.get("/unread-count", protectRoute, getUnreadCount);
router.get("/:username", protectRoute, getMessages);
router.post("/:username", protectRoute, sendMessage);

export default router;
