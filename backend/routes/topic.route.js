import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { followUnfollowTopic, getTopic, getTrendingTopics } from "../controllers/topic.controller.js";

const router = express.Router();

router.get("/trending", protectRoute, getTrendingTopics);
router.get("/:name", protectRoute, getTopic);
router.post("/:name/follow", protectRoute, followUnfollowTopic);

export default router;
