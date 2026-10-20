import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import LoadingSpinner from "../../components/common/LoadingSpinner";

import { IoSearch } from "react-icons/io5";

const SearchPage = () => {
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

			{debounced.length === 0 && <p className='text-center p-6 text-slate-500'>Type a name or username to find people.</p>}
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
		</div>
	);
};
export default SearchPage;
