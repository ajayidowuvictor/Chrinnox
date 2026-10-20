import express from "express";
import { getMe, login, logout, signup } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/me", protectRoute, getMe);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: "Too many login attempts. Please wait 15 minutes and try again." });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "Too many sign-ups from this connection. Please try again later." });

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

export default router;
