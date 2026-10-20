import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import { formatPostDate } from "../../utils/date";
import { compressImage } from "../../utils/image";

import { FaArrowLeft } from "react-icons/fa6";
import { IoSend, IoCloseSharp } from "react-icons/io5";
import { CiImageOn } from "react-icons/ci";

const getJson = async (url) => {
	const res = await fetch(url);
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

// small preview of a post that was shared in a chat
const SharedPostCard = ({ post, mine }) => {
	if (!post) {
		return <p className='text-sm italic opacity-80'>This post is no longer available.</p>;
	}
	const image = post.imgs?.[0] || post.img;
	return (
		<Link
			to={`/post/${post._id}`}
			className={`block rounded-xl overflow-hidden border ${mine ? "border-sky-300 bg-sky-600" : "border-line bg-surface"}`}
		>
			{image && <img src={image} className='w-full h-32 object-cover' alt='' />}
			<div className='p-2'>
				<p className='text-xs font-bold truncate'>
					{post.user?.fullName} <span className='font-normal opacity-70'>@{post.user?.username}</span>
				</p>
				{post.text && <p className='text-sm line-clamp-3 break-words'>{post.text}</p>}
			</div>
		</Link>
	);
};

// ---------- list of conversations + people search ----------
const ConversationList = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const shareId = searchParams.get("share");
	const suffix = shareId ? `?share=${shareId}` : "";

	const [query, setQuery] = useState("");
	const [debounced, setDebounced] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(query.trim().replace(/^@/, "")), 300);
		return () => clearTimeout(timer);
	}, [query]);

	const { data: conversations, isLoading } = useQuery({
		queryKey: ["conversations"],
		queryFn: () => getJson("/api/messages/conversations"),
		refetchInterval: 10000,
	});

	const { data: found, isFetching: isSearching } = useQuery({
		queryKey: ["search", debounced],
		queryFn: () => getJson(`/api/users/search?q=${encodeURIComponent(debounced)}`),
		enabled: debounced.length > 0,
	});

	return (
		<>
			<div className='p-4 border-b border-line'>
				<p className='font-bold'>{shareId ? "Send post to..." : "Messages"}</p>
				{shareId && (
					<p className='text-sm text-slate-500'>
						Choose who gets this post.{" "}
						<button className='text-sky-500' onClick={() => navigate("/messages")}>
							Cancel
						</button>
					</p>
				)}
			</div>

			<div className='p-4 border-b border-line'>
				<input
					type='text'
					className='input input-bordered rounded-full w-full input-sm'
					placeholder='Search people by name or username'
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>

			{debounced.length > 0 ? (
				<>
					{isSearching && (
						<div className='flex justify-center p-6'>
							<LoadingSpinner size='lg' />
						</div>
					)}
					{!isSearching && found?.length === 0 && (
						<p className='text-center p-6 text-slate-500'>No one found for &quot;{debounced}&quot;.</p>
					)}
					{!isSearching &&
						found?.map((u) => (
							<Link
								key={u._id}
								to={`/messages/${u.username}${suffix}`}
								className='flex gap-3 items-center p-4 border-b border-line hover:bg-hoverbg'
							>
								<div className='avatar'>
									<div className='w-10 rounded-full'>
										<img src={u.profileImg || "/avatar-placeholder.png"} />
									</div>
								</div>
								<div className='min-w-0'>
									<p className='font-bold truncate'>{u.fullName}</p>
									<p className='text-sm text-slate-500 truncate'>@{u.username}</p>
								</div>
							</Link>
						))}
				</>
			) : (
				<>
					{isLoading && (
						<div className='flex justify-center p-6'>
							<LoadingSpinner size='lg' />
						</div>
					)}
					{!isLoading && conversations?.length === 0 && (
						<p className='text-center p-6 text-slate-500'>
							No messages yet. Search for someone above, or open their profile and tap <b>Message</b>.
						</p>
					)}
					{conversations?.map((c) => (
						<Link
							key={c.user._id}
							to={`/messages/${c.user.username}${suffix}`}
							className='flex gap-3 items-center p-4 border-b border-line hover:bg-hoverbg'
						>
							<div className='avatar'>
								<div className='w-10 rounded-full'>
									<img src={c.user.profileImg || "/avatar-placeholder.png"} />
								</div>
							</div>
							<div className='flex-1 min-w-0'>
								<div className='flex gap-1 items-center'>
									<span className='font-bold truncate'>{c.user.fullName}</span>
									<span className='text-slate-500 text-sm'>@{c.user.username}</span>
								</div>
								<p
									className={`text-sm truncate ${
										c.unread > 0 ? "font-semibold" : "text-slate-500"
									}`}
								>
									{c.lastMessage.fromMe ? "You: " : ""}
									{c.lastMessage.text}
								</p>
							</div>
							{c.unread > 0 && (
								<span className='bg-sky-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center'>
									{c.unread}
								</span>
							)}
						</Link>
					))}
				</>
			)}
		</>
	);
};

// ---------- one chat ----------
const Chat = ({ username }) => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const shareId = searchParams.get("share");

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const [text, setText] = useState("");
	const [photo, setPhoto] = useState(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const bottomRef = useRef(null);
	const photoRef = useRef(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["messages", username],
		queryFn: () => getJson(`/api/messages/${username}`),
		refetchInterval: 4000, // checks for new messages every 4 seconds
		retry: false,
	});

	// the post being shared (shown above the box before you send it)
	const { data: sharedPost } = useQuery({
		queryKey: ["post", shareId],
		queryFn: () => getJson(`/api/posts/${shareId}`),
		enabled: !!shareId,
		retry: false,
	});

	const { mutate: send, isPending } = useMutation({
		mutationFn: async (payload) => {
			const res = await fetch(`/api/messages/${username}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await res.json();
			if (!res.ok) throw new Error(result.error || "Something went wrong");
			return result;
		},
		onSuccess: () => {
			setText("");
			setPhoto(null);
			if (shareId) navigate(`/messages/${username}`, { replace: true }); // post is sent, drop the draft
			queryClient.invalidateQueries({ queryKey: ["messages", username] });
			queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
		onError: (err) => {
			toast.error(err.message);
		},
	});

	// opening a chat marks it as read, so refresh the unread badge
	useEffect(() => {
		if (data) queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
	}, [data?.messages?.length]); // eslint-disable-line react-hooks/exhaustive-deps

	// scroll to the newest message
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [data?.messages?.length]);

	const handlePhoto = async (e) => {
		const file = e.target.files?.[0];
		e.target.value = null;
		if (!file) return;
		if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
		setIsProcessing(true);
		try {
			setPhoto(await compressImage(file));
		} catch (err) {
			toast.error(err.message);
		} finally {
			setIsProcessing(false);
		}
	};

	const canSend = text.trim() || photo || (shareId && sharedPost);

	const handleSend = (e) => {
		e.preventDefault();
		if (isPending || isProcessing || !canSend) return;
		send({
			text,
			img: photo || undefined,
			postId: shareId && sharedPost ? shareId : undefined,
		});
	};

	if (isLoading) {
		return (
			<div className='flex justify-center p-10'>
				<LoadingSpinner size='lg' />
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-6 text-center'>
				<p className='mb-4'>{error.message}</p>
				<Link to='/messages' className='btn btn-outline btn-sm rounded-full'>
					Back to messages
				</Link>
			</div>
		);
	}

	const other = data.user;

	return (
		<div className='flex flex-col h-[100dvh]'>
			<div className='flex gap-3 items-center p-4 border-b border-line'>
				<Link to='/messages'>
					<FaArrowLeft className='w-4 h-4' />
				</Link>
				<Link to={`/profile/${other.username}`} className='flex gap-3 items-center'>
					<div className='avatar'>
						<div className='w-9 rounded-full'>
							<img src={other.profileImg || "/avatar-placeholder.png"} />
						</div>
					</div>
					<div>
						<p className='font-bold leading-tight'>{other.fullName}</p>
						<p className='text-sm text-slate-500 leading-tight'>@{other.username}</p>
					</div>
				</Link>
			</div>

			<div className='flex-1 overflow-y-auto p-4 flex flex-col gap-2'>
				{data.messages.length === 0 && (
					<p className='text-center text-slate-500 mt-6'>No messages yet. Say hello 👋</p>
				)}
				{data.messages.map((m) => {
					const mine = m.from === authUser._id;
					return (
						<div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
							<div
								className={`max-w-[75%] rounded-2xl px-3 py-2 break-words flex flex-col gap-2 ${
									mine ? "bg-sky-500 text-white" : "bg-surface text-base-content"
								}`}
							>
								{m.isPostShare && <SharedPostCard post={m.post} mine={mine} />}
								{m.img && (
									<a href={m.img} target='_blank' rel='noreferrer'>
										<img src={m.img} className='rounded-xl max-h-72 w-full object-cover' alt='' />
									</a>
								)}
								{m.text && <p className='whitespace-pre-wrap px-1'>{m.text}</p>}
								<p className={`text-[10px] px-1 ${mine ? "text-sky-100" : "text-slate-400"}`}>
									{formatPostDate(m.createdAt)}
								</p>
							</div>
						</div>
					);
				})}
				<div ref={bottomRef} />
			</div>

			{(photo || shareId) && (
				<div className='px-4 pt-3 border-t border-line flex gap-3 items-start'>
					{photo && (
						<div className='relative'>
							<IoCloseSharp
								className='absolute -top-1 -right-1 text-white bg-gray-800 rounded-full w-5 h-5 cursor-pointer'
								onClick={() => setPhoto(null)}
							/>
							<img src={photo} className='h-20 rounded object-cover' alt='' />
						</div>
					)}
					{shareId && (
						<div className='relative flex-1 max-w-xs'>
							<IoCloseSharp
								className='absolute -top-1 -right-1 text-white bg-gray-800 rounded-full w-5 h-5 cursor-pointer z-10'
								onClick={() => navigate(`/messages/${username}`, { replace: true })}
							/>
							{sharedPost ? (
								<SharedPostCard post={sharedPost} mine={false} />
							) : (
								<p className='text-sm text-slate-500'>Loading the post to share...</p>
							)}
						</div>
					)}
				</div>
			)}

			<form onSubmit={handleSend} className='flex gap-2 items-center p-4 border-t border-line'>
				<CiImageOn
					className={`w-8 h-8 shrink-0 ${isProcessing ? "fill-gray-600" : "fill-primary cursor-pointer"}`}
					onClick={() => !isProcessing && photoRef.current.click()}
				/>
				<input type='file' accept='image/*' hidden ref={photoRef} onChange={handlePhoto} />
				<input
					type='text'
					className='input input-bordered rounded-full flex-1'
					placeholder={shareId ? "Add a note (optional)..." : "Write a message..."}
					maxLength={1000}
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
				<button
					className='btn btn-primary rounded-full text-white'
					disabled={isPending || isProcessing || !canSend}
					aria-label='Send'
				>
					{isPending ? <LoadingSpinner size='sm' /> : <IoSend className='w-5 h-5' />}
				</button>
			</form>
		</div>
	);
};

const MessagesPage = () => {
	const { username } = useParams();

	return (
		<div className='flex-[4_4_0] border-l border-r border-line min-h-screen'>
			{username ? <Chat key={username} username={username} /> : <ConversationList />}
		</div>
	);
};
export default MessagesPage;
