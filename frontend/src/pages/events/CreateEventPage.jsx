import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { FaArrowLeft } from "react-icons/fa6";
import { toLocalInput } from "../../utils/date/event";

const CreateEventPage = () => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [params] = useSearchParams();
	const communitySlug = params.get("community") || "";

	const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
	soon.setMinutes(0, 0, 0);
	const [f, setF] = useState({
		title: "",
		description: "",
		mode: "in_person",
		location: "",
		link: "",
		startsAt: toLocalInput(soon),
		endsAt: "",
		capacity: "",
	});
	const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

	const { mutate, isPending } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...f,
					startsAt: new Date(f.startsAt).toISOString(),
					endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
					capacity: f.capacity ? Number(f.capacity) : undefined,
					communitySlug: communitySlug || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (data) => {
			toast.success("Event created");
			queryClient.invalidateQueries({ queryKey: ["events"] });
			navigate(`/events/${data._id}`);
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className='flex-[4_4_0] border-l border-r border-line min-h-screen'>
			<div className='flex gap-4 items-center p-4 border-b border-line'>
				<Link to={communitySlug ? `/c/${communitySlug}` : "/search?tab=events"}>
					<FaArrowLeft className='w-4 h-4' />
				</Link>
				<p className='font-bold text-lg'>Host an event{communitySlug && ` in ${communitySlug}`}</p>
			</div>
			<form
				className='p-4 flex flex-col gap-4'
				onSubmit={(e) => {
					e.preventDefault();
					mutate();
				}}
			>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Title</span>
					<input className='input input-bordered' maxLength={100} value={f.title} onChange={set("title")} required />
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>What is it about? (optional)</span>
					<textarea className='textarea textarea-bordered' rows={3} maxLength={1000} value={f.description} onChange={set("description")} />
				</label>
				<div className='flex gap-3 flex-wrap'>
					<label className='flex flex-col gap-1 flex-1 min-w-40'>
						<span className='text-sm text-slate-400'>Starts</span>
						<input type='datetime-local' className='input input-bordered' value={f.startsAt} onChange={set("startsAt")} required />
					</label>
					<label className='flex flex-col gap-1 flex-1 min-w-40'>
						<span className='text-sm text-slate-400'>Ends (optional)</span>
						<input type='datetime-local' className='input input-bordered' value={f.endsAt} onChange={set("endsAt")} />
					</label>
				</div>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Where</span>
					<select className='select select-bordered' value={f.mode} onChange={set("mode")}>
						<option value='in_person'>In person</option>
						<option value='online'>Online</option>
					</select>
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>
						{f.mode === "in_person" ? "Place or address" : "Platform (optional, e.g. Google Meet)"}
					</span>
					<input className='input input-bordered' maxLength={120} value={f.location} onChange={set("location")} required={f.mode === "in_person"} />
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>
						{f.mode === "online" ? "Link to join" : "Link (optional): tickets, map, more info"}
					</span>
					<input type='url' className='input input-bordered' placeholder='https://' maxLength={300} value={f.link} onChange={set("link")} required={f.mode === "online"} />
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Maximum people (optional)</span>
					<input type='number' min={1} max={100000} className='input input-bordered' value={f.capacity} onChange={set("capacity")} />
				</label>
				<button className='btn btn-primary rounded-full text-white' disabled={isPending || f.title.trim().length < 3}>
					{isPending ? "Creating..." : "Create event"}
				</button>
			</form>
		</div>
	);
};
export default CreateEventPage;
