const opts = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

export const formatEventTime = (startsAt, endsAt) => {
	const start = new Date(startsAt);
	let text = start.toLocaleString(undefined, opts);
	if (endsAt) {
		const end = new Date(endsAt);
		const sameDay = start.toDateString() === end.toDateString();
		text += sameDay
			? ` – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
			: ` – ${end.toLocaleString(undefined, opts)}`;
	}
	return text;
};

// value for <input type="datetime-local"> (local time, no seconds)
export const toLocalInput = (date) => {
	const d = new Date(date);
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 16);
};

// a link that adds the event to Google Calendar
export const calendarUrl = (e) => {
	const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
	const end = e.endsAt || new Date(new Date(e.startsAt).getTime() + 2 * 60 * 60 * 1000);
	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: e.title,
		dates: `${fmt(e.startsAt)}/${fmt(end)}`,
		details: [e.description, e.link].filter(Boolean).join("\n\n"),
		location: e.location || "",
	});
	return `https://calendar.google.com/calendar/render?${params}`;
};
