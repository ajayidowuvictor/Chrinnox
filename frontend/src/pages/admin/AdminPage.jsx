import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";

const AdminPage = () => {
	const queryClient = useQueryClient();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const [status, setStatus] = useState("open");

	const { data: reports, isLoading, error } = useQuery({
		queryKey: ["reports", status],
		queryFn: async () => {
			const res = await fetch(`/api/reports?status=${status}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		enabled: !!authUser?.isAdmin,
		retry: false,
	});

	const { mutate: resolve, isPending } = useMutation({
		mutationFn: async ({ id, action }) => {
			const res = await fetch(`/api/reports/${id}/resolve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: () => {
			toast.success("Done");
			queryClient.invalidateQueries({ queryKey: ["reports"] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (e) => toast.error(e.message),
	});

	if (!authUser?.isAdmin)
		return (
			<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen p-8 text-center text-slate-500'>
				This page is for admins only.
			</div>
		);

	const confirmThen = (message, fn) => () => window.confirm(message) && fn();

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='p-4 border-b border-gray-700'>
				<p className='font-bold text-lg'>Moderation</p>
				<p className='text-xs text-slate-500'>Reports from members, newest first.</p>
			</div>
			<div className='flex w-full border-b border-gray-700'>
				{["open", "resolved", "dismissed"].map((s) => (
					<button key={s} type='button' onClick={() => setStatus(s)} className='flex-1 p-3 capitalize hover:bg-secondary relative'>
						{s}
						{status === s && <div className='absolute bottom-0 w-10 h-1 rounded-full bg-primary left-1/2 -translate-x-1/2' />}
					</button>
				))}
			</div>

			{isLoading && (
				<div className='flex justify-center p-6'>
					<LoadingSpinner size='lg' />
				</div>
			)}
			{error && <p className='p-6 text-center text-slate-500'>{error.message}</p>}
			{reports?.length === 0 && <p className='p-8 text-center text-slate-500'>Nothing here. 🎉</p>}

			{reports?.map((r) => {
				const author = r.targetType === "post" ? r.post?.user || r.user : r.user;
				return (
					<div key={r._id} className='p-4 border-b border-gray-700 flex flex-col gap-2'>
						<div className='flex gap-2 items-center flex-wrap text-sm'>
							<span className='badge badge-warning capitalize'>{r.reason}</span>
							<span className='badge badge-outline'>{r.targetType}</span>
							<span className='text-slate-500'>
								by <Link className='text-sky-400' to={`/profile/${r.reporter?.username}`}>@{r.reporter?.username}</Link>
							</span>
							<span className='text-slate-500 ml-auto'>{new Date(r.createdAt).toLocaleString()}</span>
						</div>
						{r.details && <p className='text-sm italic'>&ldquo;{r.details}&rdquo;</p>}

						{r.targetType === "post" && (
							<div className='border border-gray-700 rounded-xl p-3 text-sm'>
								{r.postRemoved ? (
									<span className='text-slate-500'>This post has been removed.</span>
								) : (
									<>
										<Link className='text-sky-400' to={`/profile/${author?.username}`}>@{author?.username}</Link>
										<p className='whitespace-pre-wrap break-words mt-1'>{r.post.text || "(photo only)"}</p>
										{(r.post.imgs?.length > 0 || r.post.img) && (
											<img src={r.post.imgs?.[0] || r.post.img} className='mt-2 max-h-48 rounded-lg' />
										)}
										<Link className='text-xs text-sky-400 mt-1 inline-block' to={`/post/${r.post._id}`}>Open post</Link>
									</>
								)}
							</div>
						)}
						{r.targetType === "user" && r.user && (
							<div className='text-sm'>
								Account: <Link className='text-sky-400' to={`/profile/${r.user.username}`}>@{r.user.username}</Link>
							</div>
						)}
						{author && (
							<p className='text-xs text-slate-500'>
								{r.openAgainstUser} open report{r.openAgainstUser === 1 ? "" : "s"} against @{author.username}
								{author.suspended && " · currently suspended"}
							</p>
						)}

						{r.status === "open" ? (
							<div className='flex gap-2 flex-wrap'>
								<button className='btn btn-sm btn-outline rounded-full' disabled={isPending} onClick={() => resolve({ id: r._id, action: "dismiss" })}>
									Dismiss
								</button>
								{r.targetType === "post" && !r.postRemoved && (
									<button className='btn btn-sm btn-error rounded-full' disabled={isPending} onClick={confirmThen("Remove this post for good?", () => resolve({ id: r._id, action: "remove_post" }))}>
										Remove post
									</button>
								)}
								{author && !author.suspended && (
									<button className='btn btn-sm btn-error btn-outline rounded-full' disabled={isPending} onClick={confirmThen(`Suspend @${author.username}? They will be logged out and unable to sign in.`, () => resolve({ id: r._id, action: "suspend_user" }))}>
										Suspend account
									</button>
								)}
							</div>
						) : (
							<p className='text-xs text-slate-500 capitalize'>Action taken: {(r.action || "").replace("_", " ")}</p>
						)}
					</div>
				);
			})}
		</div>
	);
};
export default AdminPage;
