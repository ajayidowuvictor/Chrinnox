import mongoose from "mongoose";
import Event from "../models/event.model.js";
import Community from "../models/community.model.js";
import User from "../models/user.model.js";
import { buildCommunityVisibility, canModerate, roleOf } from "../lib/utils/communities.js";
import { getHiddenUserIds, isBlockedBetween } from "../lib/utils/relations.js";
import { escapeRegex } from "../lib/utils/findUser.js";

const PAGE_SIZE = 15;
const PUBLIC = "username fullName profileImg";
const THREE_HOURS = 3 * 60 * 60 * 1000;

const endOf = (e) => (e.endsAt ? e.endsAt.getTime() : e.startsAt.getTime() + THREE_HOURS);
const hasEnded = (e) => endOf(e) < Date.now();

const shape = (e, meId) => {
	const me = meId.toString();
	const going = e.going.some((u) => u.toString() === me);
	const interested = e.interested.some((u) => u.toString() === me);
	return {
		_id: e._id,
		title: e.title,
		description: e.description,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		mode: e.mode,
		location: e.location,
		link: e.link,
		capacity: e.capacity,
		cancelled: e.cancelled,
		ended: hasEnded(e),
		host: e.host,
		community: e.community,
		goingCount: e.going.length,
		interestedCount: e.interested.length,
		myRsvp: going ? "going" : interested ? "interested" : "none",
		isHost: (e.host?._id || e.host).toString() === me,
	};
};

const populate = (q) =>
	q.populate({ path: "host", select: PUBLIC }).populate({ path: "community", select: "name slug owner moderators privacy" });

// can this person see this event? (blocked hosts and members-only communities are off limits)
const canSee = async (e, meId) => {
	const hostId = e.host?._id || e.host;
	if (await isBlockedBetween(meId, hostId)) return false;
	if (e.community) {
		const c = await Community.findById(e.community?._id || e.community).select("privacy members");
		if (c && c.privacy === "request" && !c.members.some((m) => m.toString() === meId.toString())) return false;
	}
	return true;
};

export const createEvent = async (req, res) => {
	try {
		const title = String(req.body.title ?? "").trim();
		const description = String(req.body.description ?? "").trim();
		const mode = req.body.mode === "online" ? "online" : "in_person";
		const location = String(req.body.location ?? "").trim().slice(0, 120);
		const link = String(req.body.link ?? "").trim();

		if (title.length < 3 || title.length > 100) return res.status(400).json({ error: "Title must be 3 to 100 characters" });
		if (description.length > 1000) return res.status(400).json({ error: "Description can be at most 1000 characters" });

		const startsAt = new Date(req.body.startsAt);
		if (Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: "Choose when it starts" });
		if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) return res.status(400).json({ error: "The start time can't be in the past" });
		if (startsAt.getTime() > Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) {
			return res.status(400).json({ error: "Events can be planned up to 2 years ahead" });
		}
		let endsAt;
		if (req.body.endsAt) {
			endsAt = new Date(req.body.endsAt);
			if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
				return res.status(400).json({ error: "The end time must be after the start" });
			}
		}

		if (mode === "in_person" && !location) return res.status(400).json({ error: "Say where it takes place" });
		if (link && !/^https?:\/\/\S+$/i.test(link)) return res.status(400).json({ error: "The link must start with http:// or https://" });
		if (mode === "online" && !link) return res.status(400).json({ error: "Add the link people should join with" });

		let capacity;
		if (req.body.capacity !== undefined && req.body.capacity !== "" && req.body.capacity !== null) {
			capacity = parseInt(req.body.capacity, 10);
			if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
				return res.status(400).json({ error: "Capacity must be a number from 1 to 100000" });
			}
		}

		let community;
		if (req.body.communitySlug) {
			community = await Community.findOne({ slug: String(req.body.communitySlug).toLowerCase() });
			if (!community) return res.status(404).json({ error: "Community not found" });
			if (!["owner", "moderator", "member"].includes(roleOf(community, req.user._id))) {
				return res.status(403).json({ error: "Join this community to host an event in it" });
			}
		}

		const upcomingMine = await Event.countDocuments({ host: req.user._id, startsAt: { $gt: new Date() }, cancelled: false });
		if (upcomingMine >= 20) return res.status(400).json({ error: "You can have up to 20 upcoming events" });

		const event = await Event.create({
			host: req.user._id,
			title,
			description,
			startsAt,
			endsAt,
			mode,
			location, // online events may still name a platform
			link,
			community: community?._id,
			capacity,
			going: [req.user._id], // the host is going
		});
		res.status(201).json({ _id: event._id });
	} catch (error) {
		console.log("Error in createEvent: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// ?when=upcoming|past|going|hosting  &q=  &community=slug  &page=
export const listEvents = async (req, res) => {
	try {
		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const me = req.user._id;
		const now = new Date();
		const when = ["upcoming", "past", "going", "hosting"].includes(req.query.when) ? req.query.when : "upcoming";

		const filters = [await buildCommunityVisibility(me)];
		const hidden = await getHiddenUserIds(me);
		if (hidden.length) filters.push({ host: { $nin: hidden } });

		// "still on or not yet started" = ends after now; approximate end with start + 3h when no end time
		const notEnded = { $or: [{ endsAt: { $gt: now } }, { endsAt: { $exists: false }, startsAt: { $gt: new Date(now.getTime() - THREE_HOURS) } }] };
		const ended = { $or: [{ endsAt: { $lte: now } }, { endsAt: { $exists: false }, startsAt: { $lte: new Date(now.getTime() - THREE_HOURS) } }] };

		if (when === "upcoming") filters.push(notEnded, { cancelled: false });
		if (when === "past") filters.push(ended);
		if (when === "going") filters.push(notEnded, { going: me, cancelled: false });
		if (when === "hosting") filters.push({ host: me }, notEnded);

		const q = String(req.query.q ?? "").trim().slice(0, 60);
		if (q) {
			const rx = new RegExp(escapeRegex(q), "i");
			filters.push({ $or: [{ title: rx }, { description: rx }, { location: rx }] });
		}
		if (req.query.community) {
			const c = await Community.findOne({ slug: String(req.query.community).toLowerCase() }).select("_id");
			if (!c) return res.status(200).json({ events: [], hasMore: false });
			filters.push({ community: c._id });
		}

		const rows = await populate(
			Event.find({ $and: filters })
				.sort({ startsAt: when === "past" ? -1 : 1 })
				.skip((page - 1) * PAGE_SIZE)
				.limit(PAGE_SIZE + 1)
		);
		res.status(200).json({ events: rows.slice(0, PAGE_SIZE).map((e) => shape(e, me)), hasMore: rows.length > PAGE_SIZE });
	} catch (error) {
		console.log("Error in listEvents: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

const load = async (req, res) => {
	if (!mongoose.isValidObjectId(req.params.id)) {
		res.status(404).json({ error: "Event not found" });
		return null;
	}
	const event = await populate(Event.findById(req.params.id));
	if (!event) {
		res.status(404).json({ error: "Event not found" });
		return null;
	}
	if (!(await canSee(event, req.user._id))) {
		res.status(403).json({ error: "You can't see this event" });
		return null;
	}
	return event;
};

export const getEvent = async (req, res) => {
	try {
		const event = await load(req, res);
		if (!event) return;
		const out = shape(event, req.user._id);
		if (out.isHost) {
			out.attendees = await User.find({ _id: { $in: event.going } }).select(PUBLIC);
		}
		res.status(200).json(out);
	} catch (error) {
		console.log("Error in getEvent: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const rsvp = async (req, res) => {
	try {
		const status = req.body.status;
		if (!["going", "interested", "none"].includes(status)) return res.status(400).json({ error: "Invalid answer" });
		const event = await load(req, res);
		if (!event) return;
		if (event.cancelled) return res.status(400).json({ error: "This event was cancelled" });
		if (hasEnded(event)) return res.status(400).json({ error: "This event has ended" });

		const me = req.user._id;
		const isHost = event.host._id.equals(me);
		const wasGoing = event.going.some((u) => u.equals(me));
		if (status === "going" && !wasGoing && event.capacity && event.going.length >= event.capacity) {
			return res.status(409).json({ error: "This event is full" });
		}
		if (isHost && status !== "going") return res.status(400).json({ error: "You are hosting this event" });

		const update = { $pull: { going: me, interested: me } };
		await Event.updateOne({ _id: event._id }, update);
		if (status === "going") await Event.updateOne({ _id: event._id }, { $addToSet: { going: me } });
		if (status === "interested") await Event.updateOne({ _id: event._id }, { $addToSet: { interested: me } });

		const fresh = await populate(Event.findById(event._id));
		res.status(200).json(shape(fresh, me));
	} catch (error) {
		console.log("Error in rsvp: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

const canManage = async (event, meId) => {
	if (event.host._id.equals(meId)) return true;
	if (event.community) {
		const c = await Community.findById(event.community._id);
		return !!c && canModerate(c, meId);
	}
	return false;
};

export const cancelEvent = async (req, res) => {
	try {
		const event = await load(req, res);
		if (!event) return;
		if (!(await canManage(event, req.user._id))) return res.status(403).json({ error: "Only the host can cancel this event" });
		await Event.updateOne({ _id: event._id }, { cancelled: !event.cancelled });
		const fresh = await populate(Event.findById(event._id));
		res.status(200).json(shape(fresh, req.user._id));
	} catch (error) {
		console.log("Error in cancelEvent: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const deleteEvent = async (req, res) => {
	try {
		const event = await load(req, res);
		if (!event) return;
		if (!(await canManage(event, req.user._id))) return res.status(403).json({ error: "Only the host can delete this event" });
		await Event.deleteOne({ _id: event._id });
		res.status(200).json({ deleted: true });
	} catch (error) {
		console.log("Error in deleteEvent: ", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
