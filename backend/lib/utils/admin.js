// Admins are named in the ADMIN_USERNAMES environment variable (comma separated).
// Nothing is stored in the database, so nobody can make themselves an admin.
export const isAdmin = (user) => {
	if (!user) return false;
	const names = String(process.env.ADMIN_USERNAMES || "")
		.split(",")
		.map((n) => n.trim().toLowerCase())
		.filter(Boolean);
	return names.includes(String(user.username).toLowerCase());
};
