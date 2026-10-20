import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	createCollection,
	deleteCollection,
	getCollectionPosts,
	listCollections,
	renameCollection,
	togglePostInCollection,
} from "../controllers/collection.controller.js";

const router = express.Router();

router.get("/", protectRoute, listCollections);
router.post("/", protectRoute, createCollection);
router.put("/:id", protectRoute, renameCollection);
router.delete("/:id", protectRoute, deleteCollection);
router.get("/:id/posts", protectRoute, getCollectionPosts);
router.post("/:id/posts/:postId", protectRoute, togglePostInCollection);

export default router;
