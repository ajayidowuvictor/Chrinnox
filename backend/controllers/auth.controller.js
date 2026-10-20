import { isAdmin } from "../lib/utils/admin.js";
import { generateTokenAndSetCookie } from "../lib/utils/generateToken.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { findUserByUsername } from "../lib/utils/findUser.js";
import { makeToken, hashToken } from "../lib/utils/tokens.js";
import { sendMail, appUrl } from "../lib/utils/mail.js";

const HOUR = 60 * 60 * 1000;

export const sendVerificationEmail = async (user) => {
	const { raw, hash } = makeToken();
	user.verifyTokenHash = hash;
	user.verifyTokenExpires = new Date(Date.now() + 24 * HOUR);
	await user.save();
	return sendMail({
		to: user.email,
		subject: "Confirm your email for Chrinnox",
		heading: `Welcome, ${user.fullName}`,
		body: "Please confirm your email address so you can get back into your account if you ever forget your password.",
		buttonText: "Confirm my email",
		buttonUrl: `${appUrl()}/verify-email/${raw}`,
	});
};

export const signup = async (req, res) => {
	try {
		const fullName = String(req.body.fullName ?? "").trim();
		const username = String(req.body.username ?? "").trim();
		const email = String(req.body.email ?? "").trim().toLowerCase();
		const password = String(req.body.password ?? "");

		if (!fullName) {
			return res.status(400).json({ error: "Full name is required" });
		}
		if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
			return res
				.status(400)
				.json({ error: "Username must be 3-20 characters: letters, numbers or underscore, no spaces" });
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({ error: "Invalid email format" });
		}

		const existingUser = await findUserByUsername(username);
		if (existingUser) {
			return res.status(400).json({ error: "Username is already taken" });
		}

		const existingEmail = await User.findOne({ email });
		if (existingEmail) {
			return res.status(400).json({ error: "Email is already taken" });
		}

		if (password.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters long" });
		}

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		const newUser = new User({
			fullName,
			username,
			email,
			password: hashedPassword,
			needsOnboarding: true,
		});

		if (newUser) {
			generateTokenAndSetCookie(newUser._id, res);
			await newUser.save();
			sendVerificationEmail(newUser).catch((e) => console.log("verification email failed:", e.message));

			res.status(201).json({
				_id: newUser._id,
				fullName: newUser.fullName,
				username: newUser.username,
				email: newUser.email,
				followers: newUser.followers,
				following: newUser.following,
				profileImg: newUser.profileImg,
				coverImg: newUser.coverImg,
				needsOnboarding: true,
			});
		} else {
			res.status(400).json({ error: "Invalid user data" });
		}
	} catch (error) {
		console.log("Error in signup controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const login = async (req, res) => {
	try {
		const { username, password } = req.body;
		const user = await findUserByUsername(username);
		const isPasswordCorrect = await bcrypt.compare(String(password ?? ""), user?.password || "");

		if (!user || !isPasswordCorrect) {
			return res.status(400).json({ error: "Invalid username or password" });
		}

		if (user.suspended) {
			return res.status(403).json({ error: "This account has been suspended" });
		}

		generateTokenAndSetCookie(user._id, res);

		res.status(200).json({
			_id: user._id,
			fullName: user.fullName,
			username: user.username,
			email: user.email,
			followers: user.followers,
			following: user.following,
			profileImg: user.profileImg,
			coverImg: user.coverImg,
		});
	} catch (error) {
		console.log("Error in login controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const logout = async (req, res) => {
	try {
		res.cookie("jwt", "", { maxAge: 0 });
		res.status(200).json({ message: "Logged out successfully" });
	} catch (error) {
		console.log("Error in logout controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getMe = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select("-password");
		const { verifyTokenHash, verifyTokenExpires, resetTokenHash, resetTokenExpires, ...safe } = user.toObject();
		res.status(200).json({ ...safe, isAdmin: isAdmin(user), emailVerified: user.emailVerified === true });
	} catch (error) {
		console.log("Error in getMe controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const resendVerification = async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (user.emailVerified) return res.status(200).json({ message: "Your email is already confirmed" });
		if (user.verifyTokenExpires && user.verifyTokenExpires.getTime() - 24 * HOUR > Date.now() - 60 * 1000) {
			return res.status(429).json({ error: "We just sent one. Please wait a minute before asking again." });
		}
		const sent = await sendVerificationEmail(user);
		if (!sent) return res.status(503).json({ error: "Email isn't available right now. Please try again later." });
		res.status(200).json({ message: `We sent a link to ${user.email}` });
	} catch (error) {
		console.log("Error in resendVerification", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const verifyEmail = async (req, res) => {
	try {
		const token = String(req.body.token ?? "");
		if (!token) return res.status(400).json({ error: "This link is not valid" });
		const user = await User.findOne({ verifyTokenHash: hashToken(token), verifyTokenExpires: { $gt: new Date() } });
		if (!user) return res.status(400).json({ error: "This link is invalid or has expired. Ask for a new one." });
		user.emailVerified = true;
		user.verifyTokenHash = undefined;
		user.verifyTokenExpires = undefined;
		await user.save();
		res.status(200).json({ message: "Email confirmed" });
	} catch (error) {
		console.log("Error in verifyEmail", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const forgotPassword = async (req, res) => {
	// always the same answer, so nobody can use this to find out who has an account
	const reply = { message: "If that email has an account, we've sent a link to reset the password." };
	try {
		const email = String(req.body.email ?? "").trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(200).json(reply);
		const user = await User.findOne({ email });
		if (user && !user.suspended) {
			const { raw, hash } = makeToken();
			user.resetTokenHash = hash;
			user.resetTokenExpires = new Date(Date.now() + HOUR);
			await user.save();
			await sendMail({
				to: user.email,
				subject: "Reset your Chrinnox password",
				heading: "Reset your password",
				body: "Someone asked to reset the password for your Chrinnox account. This link works for one hour.",
				buttonText: "Choose a new password",
				buttonUrl: `${appUrl()}/reset-password/${raw}`,
			});
		}
		res.status(200).json(reply);
	} catch (error) {
		console.log("Error in forgotPassword", error.message);
		res.status(200).json(reply);
	}
};

export const resetPassword = async (req, res) => {
	try {
		const token = String(req.body.token ?? "");
		const password = String(req.body.password ?? "");
		if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters long" });
		const user = await User.findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() } });
		if (!token || !user) return res.status(400).json({ error: "This link is invalid or has expired. Ask for a new one." });

		user.password = await bcrypt.hash(password, await bcrypt.genSalt(10));
		user.resetTokenHash = undefined;
		user.resetTokenExpires = undefined;
		user.passwordChangedAt = new Date();
		user.emailVerified = true; // they just proved they own this inbox
		await user.save();
		res.status(200).json({ message: "Password changed. You can log in now." });
	} catch (error) {
		console.log("Error in resetPassword", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
