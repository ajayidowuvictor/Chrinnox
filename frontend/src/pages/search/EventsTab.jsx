import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import EventsList from "../../components/common/EventsList";
import { IoSearch } from "react-icons/io5";

const FILTERS = [
	["upcoming", "Upcoming"],
	["going", "I'm going"],
	["hosting", "Hosting"],
	["past", "Past"],
];

const EventsTab = () => {
	const [when, setWhen] = useState("upcoming");
	const [text, setText] = useState("");
	const [q, setQ] = useState("");
	useEffect(() => {
		const t = setTimeout(() => setQ(text.trim()), 300);
		return () => clearTimeout(t);
	}, [text]);

	return (
		<>
			<div className='p-4 border-b border-line flex flex-col gap-3'>
				<div className='flex gap-2 items-center'>
					<label className='input input-bordered rounded-full flex items-center gap-2 flex-1'>
						<IoSearch className='w-5 h-5 text-slate-500' />
						<input type='text' className='grow' placeholder='Search events' value={text} onChange={(e) => setText(e.target.value)} />
					</label>
					<Link to='/events/new' className='btn btn-primary btn-sm rounded-full text-white'>
						Host
					</Link>
				</div>
				<div className='flex gap-2 overflow-x-auto pb-1'>
					{FILTERS.map(([id, label]) => (
						<button
							key={id}
							type='button'
							onClick={() => setWhen(id)}
							className={`btn btn-xs rounded-full ${when === id ? "btn-primary text-white" : "btn-outline"}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			<EventsList when={when} q={q} />
		</>
	);
};
export default EventsTab;
