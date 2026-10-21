import mongoose from "mongoose";

const connectMongoDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.MONGO_URI, {
			// fail fast and retry instead of making people wait 30 seconds on a stuck connection
			connectTimeoutMS: 10000,
			serverSelectionTimeoutMS: 15000,
			socketTimeoutMS: 45000,
			// drop idle connections before the network silently kills them
			maxIdleTimeMS: 60000,
			maxPoolSize: 10,
		});
		console.log(`MongoDB connected: ${conn.connection.host}`);

		// a tiny ping keeps one healthy connection warm while the app is awake
		setInterval(() => {
			mongoose.connection.db
				?.admin()
				.ping()
				.catch((e) => console.log("MongoDB ping failed:", e.message));
		}, 30 * 1000).unref();
	} catch (error) {
		console.error(`Error connection to mongoDB: ${error.message}`);
		process.exit(1);
	}
};

export default connectMongoDB;
