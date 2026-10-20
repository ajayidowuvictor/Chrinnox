import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	blockUnblockUser,
	getSafety,
	muteUnmuteUser,
	updateMutedWords,
	updatePrivacySettings,
	updateNotificationPrefs,
} from "../controllers/safety.controller.js";
import { completeOnboarding, followUnfollowUser, getSuggestedUsers, getUserProfile, searchUsers, updateUser } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile/:username", protectRoute, getUserProfile);
router.get("/search", protectRoute, searchUsers);
router.get("/safety", protectRoute, getSafety);
router.post("/safety/muted-words", protectRoute, updateMutedWords);
router.post("/safety/privacy", protectRoute, updatePrivacySettings);
router.post("/safety/notifications", protectRoute, updateNotificationPrefs);
router.post("/mute/:id", protectRoute, muteUnmuteUser);
router.post("/block/:id", protectRoute, blockUnblockUser);
router.get("/suggested", protectRoute, getSuggestedUsers);
router.post("/follow/:id", protectRoute, followUnfollowUser);
router.post("/update", protectRoute, updateUser);
router.post("/onboarding-complete", protectRoute, completeOnboarding);

export default router;
