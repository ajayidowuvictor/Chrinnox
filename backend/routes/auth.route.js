import express from "express";
import { getMe, login, logout, signup, forgotPassword, resetPassword, verifyEmail, resendVerification } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/me", protectRoute, getMe);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: "Too many login attempts. Please wait 15 minutes and try again." });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "Too many sign-ups from this connection. Please try again later." });

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

const mailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: "Too many requests. Please wait 15 minutes and try again." });
router.post("/forgot-password", mailLimiter, forgotPassword);
router.post("/reset-password", loginLimiter, resetPassword);
router.post("/verify-email", loginLimiter, verifyEmail);
router.post("/resend-verification", mailLimiter, protectRoute, resendVerification);

export default router;
