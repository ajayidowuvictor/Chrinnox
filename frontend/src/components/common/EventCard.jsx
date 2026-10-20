import { Link } from "react-router-dom";
import { formatEventTime } from "../../utils/date/event";

const EventCard = ({ event: e }) => (
	<Link to={`/events/${e._id}`} className='block p-4 border-b border-line hover:bg-hoverbg'>
		<div className='flex items-center gap-2 flex-wrap text-xs'>
			<span className='text-sky-400 font-semibold'>{formatEventTime(e.startsAt, e.endsAt)}</span>
			{e.cancelled && <span className='badge badge-sm badge-error'>Cancelled</span>}
			{!e.cancelled && e.ended && <span className='badge badge-sm'>Ended</span>}
			{e.mode === "online" && <span className='badge badge-sm badge-outline'>Online</span>}
			{e.myRsvp === "going" && <span className='badge badge-sm badge-success'>You&apos;re going</span>}
			{e.myRsvp === "interested" && <span className='badge badge-sm badge-info'>Interested</span>}
		</div>
		<p className='font-bold text-lg mt-1'>{e.title}</p>
		{e.location && <p className='text-sm text-slate-500'>📍 {e.location}</p>}
		<p className='text-xs text-slate-500 mt-1'>
			Hosted by @{e.host?.username}
			{e.community && <> in {e.community.name}</>} · {e.goingCount} going
			{e.capacity ? ` of ${e.capacity}` : ""}
			{e.interestedCount > 0 && ` · ${e.interestedCount} interested`}
		</p>
	</Link>
);
export default EventCard;
