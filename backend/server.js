import path from "path";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import notificationRoutes from "./routes/notification.route.js";
import messageRoutes from "./routes/message.route.js";
import topicRoutes from "./routes/topic.route.js";
import communityRoutes from "./routes/community.route.js";
import collectionRoutes from "./routes/collection.route.js";
import pushRoutes from "./routes/push.route.js";
import eventRoutes from "./routes/event.route.js";
import reportRoutes from "./routes/report.route.js";

import connectMongoDB from "./db/connectMongoDB.js";

dotenv.config();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// refuse to start with missing or weak secrets rather than run insecurely
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
	console.error("JWT_SECRET is missing or too short (use at least 16 random characters).");
	process.exit(1);
}
if (!process.env.MONGO_URI) {
	console.error("MONGO_URI is missing.");
	process.exit(1);
}

const app = express();
app.set("trust proxy", 1); // needed so secure cookies work behind hosting proxies (Render, Railway, etc.)
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// basic security headers
app.disable("x-powered-by");

// What the browser is allowed to load. Set CSP_REPORT_ONLY=1 on the host to log problems instead of blocking.
const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"media-src 'self' https:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"manifest-src 'self'",
	"worker-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'self'",
].join("; ");

app.use((req, res, next) => {
	res.set("X-Content-Type-Options", "nosniff");
	res.set("X-Frame-Options", "SAMEORIGIN");
	res.set("Referrer-Policy", "strict-origin-when-cross-origin");
	res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
	res.set("Cross-Origin-Opener-Policy", "same-origin");
	if (process.env.NODE_ENV === "production") {
		res.set("Strict-Transport-Security", "max-age=15552000");
		res.set(process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", CSP);
	}
	next();
});

app.use(express.json({ limit: "12mb" })); // to parse req.body
// limit shouldn't be too high to prevent DOS
app.use(express.urlencoded({ extended: true })); // to parse form data(urlencoded)

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/collections", collectionRoutes);

if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "/frontend/dist")));

	app.get("*", (req, res) => {
		res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
	});
}

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	connectMongoDB();
});
