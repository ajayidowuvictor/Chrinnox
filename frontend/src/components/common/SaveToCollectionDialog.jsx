import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

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

// postId = null hides the dialog
const SaveToCollectionDialog = ({ postId, onClose }) => {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");

	const { data: collections, isLoading } = useQuery({
		queryKey: ["collections", postId],
		queryFn: () => call(`/api/collections?post=${postId}`, "GET"),
		enabled: !!postId,
	});

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["collections"] });
	};

	const { mutate: toggle } = useMutation({
		mutationFn: (id) => call(`/api/collections/${id}/posts/${postId}`, "POST"),
		onSuccess: (data) => {
			queryClient.setQueryData(["authUser"], (old) => (old ? { ...old, bookmarks: data.bookmarks } : old));
			toast.success(data.added ? "Added to collection" : "Removed from collection");
			refresh();
			queryClient.invalidateQueries({ queryKey: ["posts", "collection"] });
		},
		onError: (e) => toast.error(e.message),
	});

	const { mutate: create, isPending: creating } = useMutation({
		mutationFn: async () => {
			const c = await call("/api/collections", "POST", { name });
			return call(`/api/collections/${c._id}/posts/${postId}`, "POST");
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["authUser"], (old) => (old ? { ...old, bookmarks: data.bookmarks } : old));
			toast.success("Collection created and post added");
			setName("");
			refresh();
		},
		onError: (e) => toast.error(e.message),
	});

	if (!postId) return null;

	return (
		<div className='fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4' onClick={onClose}>
			<div
				className='bg-base-100 border border-line rounded-2xl w-full max-w-sm p-5 flex flex-col gap-3'
				onClick={(e) => e.stopPropagation()}
			>
				<p className='font-bold text-lg'>Save to collection</p>
				{isLoading && <p className='text-sm text-slate-500'>Loading...</p>}
				{collections?.length === 0 && <p className='text-sm text-slate-500'>No collections yet. Make your first one below.</p>}
				<div className='flex flex-col gap-2 max-h-56 overflow-y-auto'>
					{collections?.map((c) => (
						<label key={c._id} className='flex gap-2 items-center cursor-pointer'>
							<input type='checkbox' className='checkbox checkbox-sm' checked={!!c.hasPost} onChange={() => toggle(c._id)} />
							<span className='flex-1 truncate'>{c.name}</span>
							<span className='text-xs text-slate-500'>{c.count}</span>
						</label>
					))}
				</div>
				<form
					className='flex gap-2'
					onSubmit={(e) => {
						e.preventDefault();
						if (name.trim()) create();
					}}
				>
					<input
						className='input input-bordered input-sm flex-1'
						placeholder='New collection name'
						maxLength={40}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
					<button className='btn btn-primary btn-sm rounded-full text-white' disabled={!name.trim() || creating}>
						Create
					</button>
				</form>
				<button type='button' className='btn btn-outline btn-sm rounded-full self-end' onClick={onClose}>
					Done
				</button>
			</div>
		</div>
	);
};
export default SaveToCollectionDialog;
