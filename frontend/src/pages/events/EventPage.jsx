import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import { FaArrowLeft } from "react-icons/fa6";
import { calendarUrl, formatEventTime } from "../../utils/date/event";

const call = async (url, method = "GET", body) => {
	const res = await fetch(url, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

const EventPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();

	const { data: e, isLoading, error } = useQuery({
		queryKey: ["event", id],
		queryFn: () => call(`/api/events/${id}`),
		retry: false,
	});

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["event", id] });
		queryClient.invalidateQueries({ queryKey: ["events"] });
	};

	const { mutate: answer, isPending } = useMutation({
		mutationFn: (status) => call(`/api/events/${id}/rsvp`, "POST", { status }),
		onSuccess: refresh,
		onError: (err) => toast.error(err.message),
	});
	const { mutate: cancel } = useMutation({
		mutationFn: () => call(`/api/events/${id}/cancel`, "POST"),
		onSuccess: (data) => {
			toast.success(data.cancelled ? "Event cancelled" : "Event restored");
			refresh();
		},
		onError: (err) => toast.error(err.message),
	});
	const { mutate: remove } = useMutation({
		mutationFn: () => call(`/api/events/${id}`, "DELETE"),
		onSuccess: () => {
			toast.success("Event deleted");
			queryClient.invalidateQueries({ queryKey: ["events"] });
			navigate("/search?tab=events");
		},
		onError: (err) => toast.error(err.message),
	});

	if (isLoading)
		return (
			<div className='flex-[4_4_0] flex justify-center p-10'>
				<LoadingSpinner size='lg' />
			</div>
		);
	if (error)
		return (
			<div className='flex-[4_4_0] border-l border-r border-line min-h-screen p-8 text-center text-slate-500'>
				{error.message}
				<div className='mt-4'>
					<Link to='/search?tab=events' className='btn btn-outline btn-sm rounded-full'>
						Browse events
					</Link>
				</div>
			</div>
		);

	const canManage =
		e.isHost ||
		(!!e.community && (e.community.owner === authUser?._id || (e.community.moderators || []).includes(authUser?._id)));
	const closed = e.cancelled || e.ended;
	const full = e.capacity && e.goingCount >= e.capacity && e.myRsvp !== "going";

	const share = async () => {
		const url = `${window.location.origin}/events/${e._id}`;
		try {
			if (navigator.share) await navigator.share({ title: e.title, url });
			else {
				await navigator.clipboard.writeText(url);
				toast.success("Link copied");
			}
		} catch {
			/* sharing was cancelled */
		}
	};

	return (
		<div className='flex-[4_4_0] border-l border-r border-line min-h-screen'>
			<div className='flex gap-4 items-center p-4 border-b border-line'>
				<Link to='/search?tab=events'>
					<FaArrowLeft className='w-4 h-4' />
				</Link>
				<p className='font-bold text-lg'>Event</p>
			</div>

			<div className='p-4 flex flex-col gap-3'>
				<div className='flex gap-2 items-center flex-wrap'>
					{e.cancelled && <span className='badge badge-error'>Cancelled</span>}
					{!e.cancelled && e.ended && <span className='badge'>Ended</span>}
					{e.mode === "online" && <span className='badge badge-outline'>Online</span>}
				</div>
				<h1 className='text-2xl font-extrabold break-words'>{e.title}</h1>
				<p className='text-sky-400 font-semibold'>{formatEventTime(e.startsAt, e.endsAt)}</p>
				{e.location && <p>📍 {e.location}</p>}
				{e.link && (
					<a href={e.link} target='_blank' rel='noopener noreferrer nofollow' className='text-sky-400 break-all underline'>
						{e.mode === "online" ? "Join link" : "More info"}
					</a>
				)}
				{e.description && <p className='whitespace-pre-wrap break-words'>{e.description}</p>}
				<p className='text-sm text-slate-500'>
					Hosted by{" "}
					<Link className='text-sky-400' to={`/profile/${e.host.username}`}>
						@{e.host.username}
					</Link>
					{e.community && (
						<>
							{" "}
							in{" "}
							<Link className='text-sky-400' to={`/c/${e.community.slug}`}>
								{e.community.name}
							</Link>
						</>
					)}
				</p>
				<p className='text-sm'>
					<b>{e.goingCount}</b> going{e.capacity ? ` of ${e.capacity}` : ""}
					{e.interestedCount > 0 && (
						<>
							{" · "}
							<b>{e.interestedCount}</b> interested
						</>
					)}
				</p>

				{!closed && !e.isHost && (
					<div className='flex gap-2 flex-wrap'>
						<button
							className={`btn btn-sm rounded-full ${e.myRsvp === "going" ? "btn-success" : "btn-primary text-white"}`}
							disabled={isPending || (full && e.myRsvp !== "going")}
							onClick={() => answer(e.myRsvp === "going" ? "none" : "going")}
						>
							{e.myRsvp === "going" ? "✓ Going" : full ? "Event is full" : "Going"}
						</button>
						<button
							className={`btn btn-sm rounded-full ${e.myRsvp === "interested" ? "btn-info" : "btn-outline"}`}
							disabled={isPending}
							onClick={() => answer(e.myRsvp === "interested" ? "none" : "interested")}
						>
							{e.myRsvp === "interested" ? "★ Interested" : "Interested"}
						</button>
					</div>
				)}

				<div className='flex gap-2 flex-wrap'>
					{!e.cancelled && (
						<a href={calendarUrl(e)} target='_blank' rel='noopener noreferrer' className='btn btn-outline btn-xs rounded-full'>
							Add to calendar
						</a>
					)}
					<button className='btn btn-outline btn-xs rounded-full' onClick={share}>
						Share
					</button>
					{canManage && !e.ended && (
						<button
							className='btn btn-outline btn-xs rounded-full'
							onClick={() => window.confirm(e.cancelled ? "Restore this event?" : "Cancel this event? People will see it as cancelled.") && cancel()}
						>
							{e.cancelled ? "Restore event" : "Cancel event"}
						</button>
					)}
					{canManage && (
						<button
							className='btn btn-outline btn-error btn-xs rounded-full'
							onClick={() => window.confirm("Delete this event for good?") && remove()}
						>
							Delete
						</button>
					)}
				</div>
			</div>

			{e.isHost && e.attendees && (
				<div className='border-t border-line'>
					<p className='font-bold p-4 pb-2'>Who&apos;s going ({e.attendees.length})</p>
					{e.attendees.map((u) => (
						<Link key={u._id} to={`/profile/${u.username}`} className='flex gap-3 items-center px-4 py-2 hover:bg-hoverbg'>
							<div className='avatar'>
								<div className='w-8 rounded-full'>
									<img src={u.profileImg || "/avatar-placeholder.png"} />
								</div>
							</div>
							<div className='min-w-0'>
								<p className='font-semibold truncate'>{u.fullName}</p>
								<p className='text-xs text-slate-500 truncate'>@{u.username}</p>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
};
export default EventPage;
