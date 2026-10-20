import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { deleteNotifications, getNotifications, getUnreadNotificationCount } from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/unread-count", protectRoute, getUnreadNotificationCount);
router.get("/", protectRoute, getNotifications);
router.delete("/", protectRoute, deleteNotifications);

export default router;
