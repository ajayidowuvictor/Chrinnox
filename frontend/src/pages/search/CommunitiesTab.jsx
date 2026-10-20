import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import { IoSearch } from "react-icons/io5";

export const CATEGORIES = [
	"technology", "gaming", "music", "business", "education", "sports",
	"local", "university", "professional", "hobbies", "brand", "project", "other",
];

const CommunitiesTab = () => {
	const [text, setText] = useState("");
	const [q, setQ] = useState("");
	const [category, setCategory] = useState("");
	useEffect(() => {
		const t = setTimeout(() => setQ(text.trim()), 300);
		return () => clearTimeout(t);
	}, [text]);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["communities", q, category],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (q) params.set("q", q);
			if (category) params.set("category", category);
			const res = await fetch(`/api/communities?${params}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Something went wrong");
			return json;
		},
	});

	return (
		<>
			<div className='p-4 border-b border-gray-700 flex flex-col gap-3'>
				<div className='flex gap-2 items-center'>
					<label className='input input-bordered rounded-full flex items-center gap-2 flex-1'>
						<IoSearch className='w-5 h-5 text-slate-500' />
						<input
							type='text'
							className='grow'
							placeholder='Search communities'
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
					</label>
					<Link to='/communities/new' className='btn btn-primary btn-sm rounded-full text-white'>
						Create
					</Link>
				</div>
				<div className='flex gap-2 overflow-x-auto pb-1'>
					{["", ...CATEGORIES].map((c) => (
						<button
							key={c || "all"}
							type='button'
							onClick={() => setCategory(c)}
							className={`btn btn-xs rounded-full capitalize ${category === c ? "btn-primary text-white" : "btn-outline"}`}
						>
							{c || "All"}
						</button>
					))}
				</div>
			</div>

			{isLoading && (
				<div className='flex justify-center p-6'>
					<LoadingSpinner size='lg' />
				</div>
			)}
			{isError && <p className='text-center p-6 text-slate-500'>Could not load communities. Try again.</p>}
			{data?.communities.length === 0 && (
				<p className='text-center p-6 text-slate-500'>No communities found. Why not start one?</p>
			)}
			{data?.communities.map((c) => (
				<Link
					key={c._id}
					to={`/c/${c.slug}`}
					className='block p-4 border-b border-gray-700 hover:bg-stone-900'
				>
					<div className='flex items-center gap-2 flex-wrap'>
						<span className='font-bold'>{c.name}</span>
						<span className='badge badge-sm badge-outline capitalize'>{c.category}</span>
						{c.privacy === "request" && <span className='badge badge-sm badge-warning'>Private</span>}
						{["owner", "moderator", "member"].includes(c.role) && (
							<span className='badge badge-sm badge-success'>Joined</span>
						)}
						{c.role === "pending" && <span className='badge badge-sm'>Requested</span>}
					</div>
					{c.description && <p className='text-sm mt-1 line-clamp-2'>{c.description}</p>}
					<p className='text-xs text-slate-500 mt-1'>
						{c.memberCount} {c.memberCount === 1 ? "member" : "members"}
					</p>
				</Link>
			))}
		</>
	);
};
export default CommunitiesTab;
