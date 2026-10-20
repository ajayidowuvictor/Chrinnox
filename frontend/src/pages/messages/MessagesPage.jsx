import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import { formatPostDate } from "../../utils/date";

import { FaArrowLeft } from "react-icons/fa6";
import { IoSend } from "react-icons/io5";

const getJson = async (url) => {
	const res = await fetch(url);
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

// ---------- list of conversations + start a new one ----------
const ConversationList = () => {
	const navigate = useNavigate();
	const [newUsername, setNewUsername] = useState("");

	const { data: conversations, isLoading } = useQuery({
		queryKey: ["conversations"],
		queryFn: () => getJson("/api/messages/conversations"),
		refetchInterval: 10000,
	});

	const startChat = (e) => {
		e.preventDefault();
		const name = newUsername.trim().replace(/^@/, "");
		if (name) navigate(`/messages/${name}`);
	};

	return (
		<>
			<div className='p-4 border-b border-gray-700'>
				<p className='font-bold'>Messages</p>
			</div>

			<form onSubmit={startChat} className='flex gap-2 p-4 border-b border-gray-700'>
				<input
					type='text'
					className='input input-bordered rounded-full flex-1 input-sm'
					placeholder='Start a chat: type a username'
					value={newUsername}
					onChange={(e) => setNewUsername(e.target.value)}
				/>
				<button className='btn btn-primary btn-sm rounded-full text-white px-4'>Chat</button>
			</form>

			{isLoading && (
				<div className='flex justify-center p-6'>
					<LoadingSpinner size='lg' />
				</div>
			)}
			{!isLoading && conversations?.length === 0 && (
				<p className='text-center p-6 text-slate-500'>
					No messages yet. Open someone&apos;s profile and tap <b>Message</b>, or type a username above.
				</p>
			)}
			{conversations?.map((c) => (
				<Link
					key={c.user._id}
					to={`/messages/${c.user.username}`}
					className='flex gap-3 items-center p-4 border-b border-gray-700 hover:bg-stone-900'
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
						<p className={`text-sm truncate ${c.unread > 0 ? "text-white font-semibold" : "text-slate-500"}`}>
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
	);
};

// ---------- one chat ----------
const Chat = ({ username }) => {
	const queryClient = useQueryClient();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const [text, setText] = useState("");
	const bottomRef = useRef(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["messages", username],
		queryFn: () => getJson(`/api/messages/${username}`),
		refetchInterval: 4000, // checks for new messages every 4 seconds
		retry: false,
	});

	const { mutate: send, isPending } = useMutation({
		mutationFn: async (messageText) => {
			const res = await fetch(`/api/messages/${username}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: messageText }),
			});
			const result = await res.json();
			if (!res.ok) throw new Error(result.error || "Something went wrong");
			return result;
		},
		onSuccess: () => {
			setText("");
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

	const handleSend = (e) => {
		e.preventDefault();
		if (isPending || !text.trim()) return;
		send(text);
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
		<div className='flex flex-col h-screen'>
			<div className='flex gap-3 items-center p-4 border-b border-gray-700'>
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
								className={`max-w-[75%] rounded-2xl px-4 py-2 break-words ${
									mine ? "bg-sky-500 text-white" : "bg-stone-800 text-white"
								}`}
							>
								<p className='whitespace-pre-wrap'>{m.text}</p>
								<p className={`text-[10px] mt-1 ${mine ? "text-sky-100" : "text-slate-400"}`}>
									{formatPostDate(m.createdAt)}
								</p>
							</div>
						</div>
					);
				})}
				<div ref={bottomRef} />
			</div>

			<form onSubmit={handleSend} className='flex gap-2 items-center p-4 border-t border-gray-700'>
				<input
					type='text'
					className='input input-bordered rounded-full flex-1'
					placeholder='Write a message...'
					maxLength={1000}
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
				<button
					className='btn btn-primary rounded-full text-white'
					disabled={isPending || !text.trim()}
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
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			{username ? <Chat key={username} username={username} /> : <ConversationList />}
		</div>
	);
};
export default MessagesPage;
