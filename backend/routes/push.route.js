import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { publicKey, subscribe, unsubscribe } from "../controllers/push.controller.js";

const router = express.Router();
router.get("/public-key", protectRoute, publicKey);
router.post("/subscribe", protectRoute, subscribe);
router.post("/unsubscribe", protectRoute, unsubscribe);
export default router;
