import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
	commentOnPost,
	createPost,
	deletePost,
	getAllPosts,
	getFollowingPosts,
	getLikedPosts,
	getUserPosts,
	likeUnlikePost,
	repostUnrepost,
	bookmarkUnbookmark,
	getBookmarkedPosts,
	getPostById,
	getFeed,
	helpfulUnhelpful,
	helpfulUnhelpfulComment,
} from "../controllers/post.controller.js";

const router = express.Router();

router.get("/feed", protectRoute, getFeed);
router.get("/all", protectRoute, getAllPosts);
router.get("/following", protectRoute, getFollowingPosts);
router.get("/bookmarks", protectRoute, getBookmarkedPosts);
router.get("/likes/:id", protectRoute, getLikedPosts);
router.get("/user/:username", protectRoute, getUserPosts);
const createLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, message: "You are posting too fast. Please wait a few minutes." });
const commentLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 80, message: "You are commenting too fast. Please wait a few minutes." });

router.post("/create", createLimiter, protectRoute, createPost);
router.post("/like/:id", protectRoute, likeUnlikePost);
router.post("/comment/:id", commentLimiter, protectRoute, commentOnPost);
router.post("/repost/:id", protectRoute, repostUnrepost);
router.post("/helpful/:id", protectRoute, helpfulUnhelpful);
router.post("/comment/:postId/:commentId/helpful", protectRoute, helpfulUnhelpfulComment);
router.post("/bookmark/:id", protectRoute, bookmarkUnbookmark);
router.get("/:id", protectRoute, getPostById);
router.delete("/:id", protectRoute, deletePost);

export default router;
