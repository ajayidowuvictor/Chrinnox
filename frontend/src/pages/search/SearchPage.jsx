import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import TrendingTopics from "../../components/common/TrendingTopics";
import Posts from "../../components/common/Posts";
import CommunitiesTab from "./CommunitiesTab";
import { OPPORTUNITY_KINDS } from "../home/CreatePost";

import { IoSearch } from "react-icons/io5";

const TABS = [
	{ id: "people", label: "People" },
	{ id: "opportunities", label: "Opportunities" },
	{ id: "communities", label: "Communities" },
];

const OpportunitiesTab = () => {
	const [kind, setKind] = useState("");
	const [text, setText] = useState("");
	const [q, setQ] = useState("");
	useEffect(() => {
		const t = setTimeout(() => setQ(text.trim()), 300);
		return () => clearTimeout(t);
	}, [text]);
	return (
		<>
			<div className='p-4 border-b border-gray-700 flex flex-col gap-3'>
				<label className='input input-bordered rounded-full flex items-center gap-2'>
					<IoSearch className='w-5 h-5 text-slate-500' />
					<input
						type='text'
						className='grow'
						placeholder='Search jobs, gigs, events, scholarships...'
						value={text}
						onChange={(e) => setText(e.target.value)}
					/>
				</label>
				<div className='flex gap-2 overflow-x-auto pb-1'>
					{["", ...OPPORTUNITY_KINDS].map((k) => (
						<button
							key={k || "all"}
							type='button'
							onClick={() => setKind(k)}
							className={`btn btn-xs rounded-full capitalize ${kind === k ? "btn-primary text-white" : "btn-outline"}`}
						>
							{k || "All"}
						</button>
					))}
				</div>
			</div>
			<Posts feedType='opportunities' kind={kind} q={q} />
		</>
	);
};

const SearchPage = () => {
	const [params, setParams] = useSearchParams();
	const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "people";
	const [query, setQuery] = useState("");
	const [debounced, setDebounced] = useState("");

	// wait a moment after typing stops before searching
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(query.trim().replace(/^@/, "")), 300);
		return () => clearTimeout(timer);
	}, [query]);

	const { data: results, isFetching } = useQuery({
		queryKey: ["search", debounced],
		queryFn: async () => {
			const res = await fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		enabled: debounced.length > 0,
	});

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='flex w-full border-b border-gray-700 sticky top-0 z-10 bg-base-100'>
				{TABS.map((t) => (
					<button
						key={t.id}
						type='button'
						onClick={() => setParams(t.id === "people" ? {} : { tab: t.id })}
						className='flex-1 p-3 hover:bg-secondary transition duration-300 relative'
					>
						{t.label}
						{tab === t.id && <div className='absolute bottom-0 w-10 h-1 rounded-full bg-primary left-1/2 -translate-x-1/2' />}
					</button>
				))}
			</div>
			{tab === "opportunities" && <OpportunitiesTab />}
			{tab === "communities" && <CommunitiesTab />}
			{tab === "people" && (
			<>
			<div className='p-4 border-b border-gray-700'>
				<label className='input input-bordered rounded-full flex items-center gap-2'>
					<IoSearch className='w-5 h-5 text-slate-500' />
					<input
						type='text'
						className='grow'
						placeholder='Search people by name or username'
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						autoFocus
					/>
				</label>
			</div>

			{debounced.length === 0 && (
				<>
					<p className='text-center p-6 text-slate-500'>Type a name or username to find people.</p>
					<TrendingTopics className='p-4 border-t border-gray-700' />
				</>
			)}
			{debounced.length > 0 && isFetching && (
				<div className='flex justify-center p-6'>
					<LoadingSpinner size='lg' />
				</div>
			)}
			{debounced.length > 0 && !isFetching && results?.length === 0 && (
				<p className='text-center p-6 text-slate-500'>No one found for &quot;{debounced}&quot;.</p>
			)}
			{!isFetching &&
				results?.map((user) => (
					<div key={user._id} className='flex gap-3 items-center p-4 border-b border-gray-700 hover:bg-stone-900'>
						<Link to={`/profile/${user.username}`} className='flex gap-3 items-center flex-1 min-w-0'>
							<div className='avatar'>
								<div className='w-10 rounded-full'>
									<img src={user.profileImg || "/avatar-placeholder.png"} />
								</div>
							</div>
							<div className='min-w-0'>
								<p className='font-bold truncate'>{user.fullName}</p>
								<p className='text-sm text-slate-500 truncate'>@{user.username}</p>
								{user.bio && <p className='text-sm truncate'>{user.bio}</p>}
							</div>
						</Link>
						<Link to={`/messages/${user.username}`} className='btn btn-outline btn-sm rounded-full'>
							Message
						</Link>
					</div>
				))}
			</>
			)}
		</div>
	);
};
export default SearchPage;
