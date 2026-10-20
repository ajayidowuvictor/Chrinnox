import { isAdmin } from "../lib/utils/admin.js";
import { generateTokenAndSetCookie } from "../lib/utils/generateToken.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { findUserByUsername } from "../lib/utils/findUser.js";

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
		});

		if (newUser) {
			generateTokenAndSetCookie(newUser._id, res);
			await newUser.save();

			res.status(201).json({
				_id: newUser._id,
				fullName: newUser.fullName,
				username: newUser.username,
				email: newUser.email,
				followers: newUser.followers,
				following: newUser.following,
				profileImg: newUser.profileImg,
				coverImg: newUser.coverImg,
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
		res.status(200).json({ ...user.toObject(), isAdmin: isAdmin(user) });
	} catch (error) {
		console.log("Error in getMe controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
