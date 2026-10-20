// "Closes in 5 days" style text for an opportunity deadline
export const describeDeadline = (deadline) => {
	if (!deadline) return null;
	const end = new Date(deadline);
	end.setHours(23, 59, 59, 999); // a deadline date lasts until the end of that day
	const msLeft = end.getTime() - Date.now();
	if (msLeft < 0) return { text: "Closed", closed: true };
	const days = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
	if (days <= 1) return { text: "Closes today", closed: false };
	if (days <= 14) return { text: `Closes in ${days} days`, closed: false };
	return {
		text: `Closes ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
		closed: false,
	};
};
