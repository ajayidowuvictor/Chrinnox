import { FaRegComment, FaRegLightbulb, FaLightbulb, FaThumbtack, FaCheckCircle } from "react-icons/fa";
import { BiRepost } from "react-icons/bi";
import { FaRegHeart } from "react-icons/fa";
import { FaRegBookmark, FaBookmark, FaShareNodes } from "react-icons/fa6";
import { IoEllipsisHorizontal } from "react-icons/io5";
import { FaTrash, FaPen } from "react-icons/fa";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "./LoadingSpinner";
import PostText from "./PostText";
import { formatPostDate } from "../../utils/date";
import { describeDeadline } from "../../utils/date/deadline";
import useSafetyActions from "../../hooks/useSafetyActions";
import ReportDialog from "./ReportDialog";
import SaveToCollectionDialog from "./SaveToCollectionDialog";

const Post = ({ post }) => {
	const [comment, setComment] = useState("");
	const [commentSort, setCommentSort] = useState("helpful");
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { toggleMute, toggleBlock } = useSafetyActions();
	const [reportTarget, setReportTarget] = useState(null);
	const [collectionOpen, setCollectionOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const postOwner = post.user;
	const isLiked = post.likes.includes(authUser._id);
	const isReposted = (post.reposts || []).includes(authUser._id);
	const isSaved = (authUser.bookmarks || []).includes(post._id);

	const isMyPost = authUser._id === post.user._id;
	const isHelpful = (post.helpful || []).includes(authUser._id);
	const isQuestion = post.type === "question";
	const isAnswered = isQuestion && !!post.acceptedComment;
	const community = post.community; // filled in by the server when the post belongs to a community
	const isCommunityMod =
		!!community && (community.owner === authUser._id || (community.moderators || []).includes(authUser._id));
	const deadline = post.type === "opportunity" ? describeDeadline(post.opportunity?.deadline) : null;

	// replies: most helpful first (ties keep the original order), or newest, or oldest
	const sortedComments = [...post.comments].sort((a, b) => {
		// the best answer to a question always comes first
		if (post.acceptedComment) {
			if (a._id === post.acceptedComment) return -1;
			if (b._id === post.acceptedComment) return 1;
		}
		if (commentSort === "newest") return post.comments.indexOf(b) - post.comments.indexOf(a);
		if (commentSort === "oldest") return post.comments.indexOf(a) - post.comments.indexOf(b);
		return (b.helpful?.length || 0) - (a.helpful?.length || 0) || post.comments.indexOf(a) - post.comments.indexOf(b);
	});

	// change this post everywhere it is on screen (feeds and the single-post page)
	const updateCachedPost = (updater) => {
		queryClient.setQueriesData({ queryKey: ["posts"] }, (old) => {
			if (!old?.pages) return old;
			return {
				...old,
				pages: old.pages.map((pg) => ({
					...pg,
					posts: pg.posts.map((p) => (p._id === post._id ? updater(p) : p)),
				})),
			};
		});
		queryClient.setQueryData(["post", post._id], (old) => (old ? updater(old) : old));
	};
	const images = post.imgs?.length ? post.imgs : post.img ? [post.img] : [];

	const formattedDate = formatPostDate(post.createdAt);

	const { mutate: deletePost, isPending: isDeleting } = useMutation({
		mutationFn: async () => {
			try {
				const res = await fetch(`/api/posts/${post._id}`, {
					method: "DELETE",
				});
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				return data;
			} catch (error) {
				throw new Error(error);
			}
		},
		onSuccess: () => {
			toast.success("Post deleted successfully");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	});

	const { mutate: likePost, isPending: isLiking } = useMutation({
		mutationFn: async () => {
			try {
				const res = await fetch(`/api/posts/like/${post._id}`, {
					method: "POST",
				});
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				return data;
			} catch (error) {
				throw new Error(error);
			}
		},
		onSuccess: (updatedLikes) => {
			// this is not the best UX, bc it will refetch all posts
			// queryClient.invalidateQueries({ queryKey: ["posts"] });

			// instead, update the cache directly for that post
			updateCachedPost((p) => ({ ...p, likes: updatedLikes }));
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const { mutate: repostPost, isPending: isReposting } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/posts/repost/${post._id}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (updatedReposts) => {
			updateCachedPost((p) => ({ ...p, reposts: updatedReposts }));
			toast.success(updatedReposts.includes(authUser._id) ? "Reposted" : "Repost removed");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const { mutate: markHelpful, isPending: isMarkingHelpful } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/posts/helpful/${post._id}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (updated) => updateCachedPost((p) => ({ ...p, helpful: updated })),
		onError: (error) => toast.error(error.message),
	});

	const { mutate: markCommentHelpful } = useMutation({
		mutationFn: async (commentId) => {
			const res = await fetch(`/api/posts/comment/${post._id}/${commentId}/helpful`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return { commentId, helpful: data };
		},
		onSuccess: ({ commentId, helpful }) =>
			updateCachedPost((p) => ({
				...p,
				comments: p.comments.map((c) => (c._id === commentId ? { ...c, helpful } : c)),
			})),
		onError: (error) => toast.error(error.message),
	});

	const { mutate: saveEdit, isPending: isSavingEdit } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/posts/${post._id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: editText }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (data) => {
			updateCachedPost((p) => ({ ...p, text: data.text, topics: data.topics, editedAt: data.editedAt }));
			setEditing(false);
			queryClient.invalidateQueries({ queryKey: ["trendingTopics"] });
			toast.success("Post updated");
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: deleteReply } = useMutation({
		mutationFn: async (commentId) => {
			const res = await fetch(`/api/posts/${post._id}/comment/${commentId}`, { method: "DELETE" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return commentId;
		},
		onSuccess: (commentId) => {
			updateCachedPost((p) => ({
				...p,
				comments: p.comments.filter((c) => c._id !== commentId),
				acceptedComment: p.acceptedComment === commentId ? undefined : p.acceptedComment,
			}));
			toast.success("Reply deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: togglePin } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/communities/${community.slug}/pin/${post._id}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (data) => {
			toast.success(data.pinned ? "Pinned to the top of the community" : "Unpinned");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: chooseBestAnswer } = useMutation({
		mutationFn: async (commentId) => {
			const res = await fetch(`/api/posts/${post._id}/accept/${commentId}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (data) => updateCachedPost((p) => ({ ...p, acceptedComment: data.acceptedComment || undefined })),
		onError: (error) => toast.error(error.message),
	});

	const { mutate: savePost, isPending: isSaving } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/posts/bookmark/${post._id}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (updatedBookmarks) => {
			queryClient.setQueryData(["authUser"], (old) => (old ? { ...old, bookmarks: updatedBookmarks } : old));
			const nowSaved = updatedBookmarks.includes(post._id);
			toast.success(nowSaved ? "Saved to your bookmarks" : "Removed from bookmarks");
			if (!nowSaved) {
				queryClient.invalidateQueries({ queryKey: ["collections"] });
				queryClient.invalidateQueries({ queryKey: ["posts", "collection"] });
			}
			// on the Saved page, an unsaved post should disappear
			if (!nowSaved && window.location.pathname === "/bookmarks") {
				queryClient.setQueriesData({ queryKey: ["posts", "bookmarks"] }, (old) =>
					old?.pages
						? { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => p._id !== post._id) })) }
						: old
				);
			}
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const { mutate: commentPost, isPending: isCommenting } = useMutation({
		mutationFn: async () => {
			try {
				const res = await fetch(`/api/posts/comment/${post._id}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ text: comment }),
				});
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				return data;
			} catch (error) {
				throw new Error(error);
			}
		},
		onSuccess: () => {
			toast.success("Comment posted successfully");
			setComment("");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["post", post._id] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleDeletePost = () => {
		deletePost();
	};

	const handlePostComment = (e) => {
		e.preventDefault();
		if (isCommenting) return;
		commentPost();
	};

	const handleSendInMessage = () => {
		if (document.activeElement) document.activeElement.blur(); // closes the menu
		navigate(`/messages?share=${post._id}`);
	};

	const handleShare = async () => {
		const url = `${window.location.origin}/post/${post._id}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Link copied. Paste it anywhere to share this post");
		} catch {
			try {
				if (navigator.share) await navigator.share({ title: "Chrinnox", url });
				else toast.error("Could not copy the link");
			} catch (err) {
				if (err?.name !== "AbortError") toast.error("Could not share this post");
			}
		}
	};

	const handleRepost = () => {
		if (isReposting) return;
		repostPost();
	};

	const handleSave = () => {
		if (isSaving) return;
		savePost();
	};

	const handleLikePost = () => {
		if (isLiking) return;
		likePost();
	};

	return (
		<>
			<ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
			<SaveToCollectionDialog postId={collectionOpen ? post._id : null} onClose={() => setCollectionOpen(false)} />
			<div className='flex gap-2 items-start p-4 border-b border-gray-700'>
				<div className='avatar'>
					<Link to={`/profile/${postOwner.username}`} className='w-8 rounded-full overflow-hidden'>
						<img src={postOwner.profileImg || "/avatar-placeholder.png"} />
					</Link>
				</div>
				<div className='flex flex-col flex-1'>
					{post.repostedBy && (
						<Link
							to={`/profile/${post.repostedBy.username}`}
							className='flex gap-1 items-center text-xs text-slate-500 mb-1 hover:underline'
						>
							<BiRepost className='w-4 h-4' />
							{post.repostedBy.username === authUser.username ? "You" : post.repostedBy.fullName} reposted
						</Link>
					)}
					{(post.pinned || community) && (
						<div className='flex gap-2 items-center text-xs text-slate-500 mb-1 flex-wrap'>
							{post.pinned && (
								<span className='flex gap-1 items-center text-amber-400'>
									<FaThumbtack /> Pinned
								</span>
							)}
							{community && (
								<Link to={`/c/${community.slug}`} className='hover:underline'>
									in {community.name}
								</Link>
							)}
						</div>
					)}
					<div className='flex gap-2 items-center'>
						<Link to={`/profile/${postOwner.username}`} className='font-bold'>
							{postOwner.fullName}
						</Link>
						<span className='text-gray-700 flex gap-1 text-sm'>
							<Link to={`/profile/${postOwner.username}`}>@{postOwner.username}</Link>
							<span>·</span>
							<Link to={`/post/${post._id}`} className='hover:underline'>
								{formattedDate}
							</Link>
							{post.editedAt && <span title={new Date(post.editedAt).toLocaleString()}>· edited</span>}
						</span>
						{(!isMyPost || isCommunityMod) && (
							<div className='dropdown dropdown-end flex justify-end flex-1'>
								<button tabIndex={0} aria-label='More options'>
									<IoEllipsisHorizontal className='w-5 h-5 text-slate-500 hover:text-white' />
								</button>
								<ul
									tabIndex={0}
									className='dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-56 border border-gray-700 mt-6'
								>
									{isCommunityMod && (
										<li>
											<a
												onClick={() => {
													document.activeElement?.blur();
													togglePin();
												}}
											>
												{post.pinned ? "Unpin from community" : "Pin to community"}
											</a>
										</li>
									)}
									{isCommunityMod && !isMyPost && (
										<li>
											<a
												onClick={() => {
													document.activeElement?.blur();
													if (window.confirm("Remove this post from the community?")) deletePost();
												}}
											>
												Remove post (moderator)
											</a>
										</li>
									)}
									{!isMyPost && (
										<li>
											<a
												onClick={() => {
													document.activeElement?.blur();
													toggleMute(postOwner._id);
												}}
											>
												Mute @{postOwner.username}
											</a>
										</li>
									)}
									{!isMyPost && (
										<li>
											<a
												onClick={() => {
													document.activeElement?.blur();
													if (window.confirm(`Block @${postOwner.username}? They won't be able to follow, message or reply to you.`)) {
														toggleBlock(postOwner._id);
													}
												}}
											>
												Block @{postOwner.username}
											</a>
										</li>
									)}
									{!isMyPost && (
										<li>
											<a
												onClick={() => {
													document.activeElement?.blur();
													setReportTarget({ type: "post", id: post._id });
												}}
											>
												Report post
											</a>
										</li>
									)}
								</ul>
							</div>
						)}
						{isMyPost && (
							<span className='flex justify-end flex-1 gap-3 items-center'>
								{!isDeleting && (
									<FaPen
										className='cursor-pointer hover:text-sky-400 w-3 h-3'
										aria-label='Edit post'
										onClick={() => {
											setEditText(post.text || "");
											setEditing(true);
										}}
									/>
								)}
								{!isDeleting && (
									<FaTrash className='cursor-pointer hover:text-red-500' onClick={handleDeletePost} />
								)}

								{isDeleting && <LoadingSpinner size='sm' />}
							</span>
						)}
					</div>
					<div className='flex flex-col gap-3 overflow-hidden'>
						{(post.type === "question" || post.type === "announcement" || post.type === "opportunity") && (
							<div className='flex gap-2 items-center flex-wrap'>
								{isQuestion && (
									<span className={`badge badge-sm ${isAnswered ? "badge-success" : "badge-info"}`}>
										{isAnswered ? "Answered" : "Question"}
									</span>
								)}
								{post.type === "announcement" && <span className='badge badge-sm badge-warning'>Announcement</span>}
								{post.type === "opportunity" && (
									<span className='badge badge-sm badge-primary capitalize'>
										{post.opportunity?.kind || "Opportunity"}
									</span>
								)}
								{post.type === "opportunity" && post.opportunity?.location && (
									<span className='text-xs text-slate-400'>📍 {post.opportunity.location}</span>
								)}
								{deadline && (
									<span className={`text-xs ${deadline.closed ? "text-red-400" : "text-amber-400"}`}>
										{deadline.text}
									</span>
								)}
							</div>
						)}
						{editing ? (
							<div className='flex flex-col gap-2'>
								<textarea
									className='textarea textarea-bordered w-full'
									rows={4}
									maxLength={500}
									value={editText}
									onChange={(e) => setEditText(e.target.value)}
									autoFocus
								/>
								<div className='flex gap-2 justify-end items-center'>
									<span className='text-xs text-slate-500 mr-auto'>{editText.length}/500</span>
									<button type='button' className='btn btn-outline btn-xs rounded-full' onClick={() => setEditing(false)}>
										Cancel
									</button>
									<button
										type='button'
										className='btn btn-primary btn-xs rounded-full text-white'
										disabled={isSavingEdit}
										onClick={() => saveEdit()}
									>
										{isSavingEdit ? "Saving..." : "Save"}
									</button>
								</div>
							</div>
						) : (
							<PostText text={post.text} />
						)}
						{post.type === "opportunity" && post.opportunity?.link && (
							<a
								href={post.opportunity.link}
								target='_blank'
								rel='noopener noreferrer nofollow'
								className='btn btn-primary btn-sm rounded-full text-white w-fit'
							>
								Apply / learn more
							</a>
						)}
						{images.length === 1 && (
							<a href={images[0]} target='_blank' rel='noreferrer'>
								<img
									src={images[0]}
									className='max-h-96 w-full object-contain rounded-lg border border-gray-700'
									alt=''
								/>
							</a>
						)}
						{images.length > 1 && (
							<div className='grid grid-cols-2 gap-1 rounded-lg overflow-hidden border border-gray-700'>
								{images.map((src, i) => (
									<a
										key={src + i}
										href={src}
										target='_blank'
										rel='noreferrer'
										className={images.length === 3 && i === 0 ? "row-span-2" : ""}
									>
										<img
											src={src}
											className={`w-full object-cover ${
												images.length === 3 && i === 0 ? "h-full min-h-64" : "h-32 sm:h-40"
											}`}
											alt=''
										/>
									</a>
								))}
							</div>
						)}
					</div>
					<div className='flex justify-between mt-3'>
						<div className='flex gap-4 items-center w-2/3 justify-between'>
							<div
								className='flex gap-1 items-center cursor-pointer group'
								onClick={() => document.getElementById("comments_modal" + post._id).showModal()}
							>
								<FaRegComment className='w-4 h-4  text-slate-500 group-hover:text-sky-400' />
								<span className='text-sm text-slate-500 group-hover:text-sky-400'>
									{post.comments.length}
								</span>
							</div>
							{/* We're using Modal Component from DaisyUI */}
							<dialog id={`comments_modal${post._id}`} className='modal border-none outline-none'>
								<div className='modal-box rounded border border-gray-600'>
									<div className='flex items-center justify-between mb-4'>
										<h3 className='font-bold text-lg'>COMMENTS</h3>
										{post.comments.length > 1 && (
											<select
												className='select select-bordered select-xs'
												value={commentSort}
												onChange={(e) => setCommentSort(e.target.value)}
												aria-label='Sort replies'
											>
												<option value='helpful'>Most helpful</option>
												<option value='newest'>Newest</option>
												<option value='oldest'>Oldest</option>
											</select>
										)}
									</div>
									<div className='flex flex-col gap-3 max-h-60 overflow-auto'>
										{post.comments.length === 0 && (
											<p className='text-sm text-slate-500'>
												No comments yet 🤔 Be the first one 😉
											</p>
										)}
										{sortedComments.map((comment) => (
											<div key={comment._id} className='flex gap-2 items-start'>
												<div className='avatar'>
													<div className='w-8 rounded-full'>
														<img
															src={comment.user.profileImg || "/avatar-placeholder.png"}
														/>
													</div>
												</div>
												<div className='flex flex-col flex-1'>
													<div className='flex items-center gap-1 flex-wrap'>
														<span className='font-bold'>{comment.user.fullName}</span>
														<span className='text-gray-700 text-sm'>
															@{comment.user.username}
														</span>
														{post.acceptedComment === comment._id && (
															<span className='badge badge-success badge-sm gap-1'>
																<FaCheckCircle /> Best answer
															</span>
														)}
													</div>
													<div className='text-sm'>
														<PostText text={comment.text} />
													</div>
													<button
														type='button'
														className={`flex gap-1 items-center text-xs mt-1 w-fit ${
															(comment.helpful || []).includes(authUser._id)
																? "text-amber-400"
																: "text-slate-500 hover:text-amber-400"
														}`}
														onClick={() => markCommentHelpful(comment._id)}
													>
														{(comment.helpful || []).includes(authUser._id) ? <FaLightbulb /> : <FaRegLightbulb />}
														Helpful{(comment.helpful || []).length > 0 ? ` · ${comment.helpful.length}` : ""}
													</button>
													{(comment.user._id === authUser._id || isMyPost || isCommunityMod) && (
														<button
															type='button'
															className='text-xs mt-1 w-fit text-slate-500 hover:text-red-400'
															onClick={() => window.confirm("Delete this reply?") && deleteReply(comment._id)}
														>
															Delete reply
														</button>
													)}
													{isQuestion && isMyPost && (
														<button
															type='button'
															className='text-xs mt-1 w-fit text-slate-500 hover:text-green-400'
															onClick={() => chooseBestAnswer(comment._id)}
														>
															{post.acceptedComment === comment._id ? "Remove best answer" : "Mark as best answer"}
														</button>
													)}
												</div>
											</div>
										))}
									</div>
									<form
										className='flex gap-2 items-center mt-4 border-t border-gray-600 pt-2'
										onSubmit={handlePostComment}
									>
										<textarea
											className='textarea w-full p-1 rounded text-md resize-none border focus:outline-none  border-gray-800'
											placeholder='Add a comment...'
											value={comment}
											onChange={(e) => setComment(e.target.value)}
										/>
										<button className='btn btn-primary rounded-full btn-sm text-white px-4'>
											{isCommenting ? <LoadingSpinner size='md' /> : "Post"}
										</button>
									</form>
								</div>
								<form method='dialog' className='modal-backdrop'>
									<button className='outline-none'>close</button>
								</form>
							</dialog>
							<div className='flex gap-1 items-center group cursor-pointer' onClick={handleRepost}>
								{isReposting ? (
									<LoadingSpinner size='sm' />
								) : (
									<BiRepost
										className={`w-6 h-6 group-hover:text-green-500 ${
											isReposted ? "text-green-500" : "text-slate-500"
										}`}
									/>
								)}
								<span
									className={`text-sm group-hover:text-green-500 ${
										isReposted ? "text-green-500" : "text-slate-500"
									}`}
								>
									{(post.reposts || []).length}
								</span>
							</div>
							<div
								className='flex gap-1 items-center group cursor-pointer'
								title='Mark as helpful'
								onClick={() => !isMarkingHelpful && markHelpful()}
							>
								{isHelpful ? (
									<FaLightbulb className='w-4 h-4 text-amber-400' />
								) : (
									<FaRegLightbulb className='w-4 h-4 text-slate-500 group-hover:text-amber-400' />
								)}
								<span className={`text-sm group-hover:text-amber-400 ${isHelpful ? "text-amber-400" : "text-slate-500"}`}>
									{(post.helpful || []).length}
								</span>
							</div>
							<div className='flex gap-1 items-center group cursor-pointer' onClick={handleLikePost}>
								{isLiking && <LoadingSpinner size='sm' />}
								{!isLiked && !isLiking && (
									<FaRegHeart className='w-4 h-4 cursor-pointer text-slate-500 group-hover:text-pink-500' />
								)}
								{isLiked && !isLiking && (
									<FaRegHeart className='w-4 h-4 cursor-pointer text-pink-500 ' />
								)}

								<span
									className={`text-sm  group-hover:text-pink-500 ${
										isLiked ? "text-pink-500" : "text-slate-500"
									}`}
								>
									{post.likes.length}
								</span>
							</div>
						</div>
						<div className='flex w-1/3 justify-end gap-3 items-center'>
							<div className='dropdown dropdown-top dropdown-end'>
								<button tabIndex={0} aria-label='Share post'>
									<FaShareNodes className='w-4 h-4 text-slate-500 hover:text-sky-500 cursor-pointer' />
								</button>
								<ul
									tabIndex={0}
									className='dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-gray-700'
								>
									<li>
										<a onClick={handleShare}>Copy link</a>
									</li>
									<li>
										<a onClick={handleSendInMessage}>Send in message</a>
									</li>
									<li>
										<a
											onClick={() => {
												document.activeElement?.blur();
												setCollectionOpen(true);
											}}
										>
											Save to collection
										</a>
									</li>
								</ul>
							</div>
							<button onClick={handleSave} aria-label={isSaved ? "Remove bookmark" : "Save post"}>
								{isSaved ? (
									<FaBookmark className='w-4 h-4 text-sky-500 cursor-pointer' />
								) : (
									<FaRegBookmark className='w-4 h-4 text-slate-500 hover:text-sky-500 cursor-pointer' />
								)}
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};
export default Post;
