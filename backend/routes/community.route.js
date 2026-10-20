import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
	createCommunity,
	decideRequest,
	deleteCommunity,
	getCommunity,
	getMembers,
	getRequests,
	joinCommunity,
	leaveCommunity,
	listCommunities,
	myCommunities,
	removeMember,
	toggleModerator,
	togglePin,
	updateCommunity,
} from "../controllers/community.controller.js";

const router = express.Router();

const createLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 5,
	message: "You are creating communities too fast. Please try again later.",
});

// fixed paths first
router.get("/", protectRoute, listCommunities);
router.get("/mine", protectRoute, myCommunities);
router.post("/", createLimiter, protectRoute, createCommunity);

router.get("/:slug", protectRoute, getCommunity);
router.put("/:slug", protectRoute, updateCommunity);
router.delete("/:slug", protectRoute, deleteCommunity);
router.post("/:slug/join", protectRoute, joinCommunity);
router.post("/:slug/leave", protectRoute, leaveCommunity);
router.get("/:slug/members", protectRoute, getMembers);
router.get("/:slug/requests", protectRoute, getRequests);
router.post("/:slug/requests/:userId/approve", protectRoute, decideRequest(true));
router.post("/:slug/requests/:userId/reject", protectRoute, decideRequest(false));
router.post("/:slug/members/:userId/remove", protectRoute, removeMember);
router.post("/:slug/moderators/:userId", protectRoute, toggleModerator);
router.post("/:slug/pin/:postId", protectRoute, togglePin);

export default router;
