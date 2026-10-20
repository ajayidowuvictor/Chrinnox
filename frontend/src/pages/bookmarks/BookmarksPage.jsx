import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Posts from "../../components/common/Posts";

const call = async (url, method, body) => {
	const res = await fetch(url, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

const BookmarksPage = () => {
	const queryClient = useQueryClient();
	const [active, setActive] = useState("all"); // "all" or a collection id

	const { data: collections } = useQuery({
		queryKey: ["collections", "list"],
		queryFn: () => call("/api/collections", "GET"),
	});
	const current = collections?.find((c) => c._id === active);
	// if the open collection vanished (deleted elsewhere), fall back to all
	const showing = current ? current._id : "all";

	const done = (message) => {
		toast.success(message);
		queryClient.invalidateQueries({ queryKey: ["collections"] });
	};

	const { mutate: rename } = useMutation({
		mutationFn: (name) => call(`/api/collections/${current._id}`, "PUT", { name }),
		onSuccess: () => done("Renamed"),
		onError: (e) => toast.error(e.message),
	});
	const { mutate: remove } = useMutation({
		mutationFn: () => call(`/api/collections/${current._id}`, "DELETE"),
		onSuccess: () => {
			setActive("all");
			done("Collection deleted. Its posts are still saved.");
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='p-4 border-b border-gray-700'>
				<p className='font-bold'>Saved</p>
				<p className='text-sm text-slate-500'>Posts you have bookmarked</p>
			</div>

			<div className='flex gap-2 overflow-x-auto p-3 border-b border-gray-700'>
				<button
					type='button'
					onClick={() => setActive("all")}
					className={`btn btn-xs rounded-full ${showing === "all" ? "btn-primary text-white" : "btn-outline"}`}
				>
					All saved
				</button>
				{collections?.map((c) => (
					<button
						key={c._id}
						type='button'
						onClick={() => setActive(c._id)}
						className={`btn btn-xs rounded-full whitespace-nowrap ${showing === c._id ? "btn-primary text-white" : "btn-outline"}`}
					>
						{c.name} · {c.count}
					</button>
				))}
			</div>
			{collections?.length === 0 && (
				<p className='text-xs text-slate-500 px-4 pt-3'>
					Tip: tap the share button on a saved post and choose &quot;Save to collection&quot; to organise your bookmarks.
				</p>
			)}

			{current && (
				<div className='flex gap-2 justify-end p-3 border-b border-gray-700'>
					<button
						type='button'
						className='btn btn-outline btn-xs rounded-full'
						onClick={() => {
							const name = window.prompt("New name for this collection", current.name);
							if (name && name.trim() && name.trim() !== current.name) rename(name.trim());
						}}
					>
						Rename
					</button>
					<button
						type='button'
						className='btn btn-outline btn-error btn-xs rounded-full'
						onClick={() => window.confirm(`Delete the collection "${current.name}"? The posts stay saved.`) && remove()}
					>
						Delete collection
					</button>
				</div>
			)}

			{showing === "all" ? <Posts feedType='bookmarks' /> : <Posts key={showing} feedType='collection' slug={showing} />}
		</div>
	);
};
export default BookmarksPage;
