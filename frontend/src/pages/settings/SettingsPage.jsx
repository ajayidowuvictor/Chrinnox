import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import useSafetyActions from "../../hooks/useSafetyActions";

import { IoCloseSharp } from "react-icons/io5";

const OPTIONS = [
	{ value: "everyone", label: "Everyone" },
	{ value: "following", label: "People I follow" },
	{ value: "nobody", label: "Nobody" },
];

const postJson = async (url, body) => {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

const Section = ({ title, hint, children }) => (
	<section className='p-4 border-b border-gray-700'>
		<h2 className='font-bold text-lg'>{title}</h2>
		{hint && <p className='text-sm text-slate-500 mb-3'>{hint}</p>}
		{children}
	</section>
);

const AudiencePicker = ({ label, value, onChange }) => (
	<div className='mb-4'>
		<p className='mb-1 font-semibold'>{label}</p>
		<div className='join flex-wrap'>
			{OPTIONS.map((o) => (
				<button
					key={o.value}
					className={`btn btn-sm join-item ${value === o.value ? "btn-primary text-white" : "btn-outline"}`}
					onClick={() => onChange(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	</div>
);

const PeopleList = ({ people, actionLabel, onAction, emptyText }) => (
	<>
		{people.length === 0 && <p className='text-sm text-slate-500'>{emptyText}</p>}
		{people.map((u) => (
			<div key={u._id} className='flex items-center gap-3 py-2'>
				<div className='avatar'>
					<div className='w-9 rounded-full'>
						<img src={u.profileImg || "/avatar-placeholder.png"} />
					</div>
				</div>
				<Link to={`/profile/${u.username}`} className='flex-1 min-w-0'>
					<p className='font-bold truncate'>{u.fullName}</p>
					<p className='text-sm text-slate-500 truncate'>@{u.username}</p>
				</Link>
				<button className='btn btn-outline btn-sm rounded-full' onClick={() => onAction(u._id)}>
					{actionLabel}
				</button>
			</div>
		))}
	</>
);

const SettingsPage = () => {
	const queryClient = useQueryClient();
	const { toggleMute, toggleBlock } = useSafetyActions();
	const [newWord, setNewWord] = useState("");

	const { data: safety, isLoading } = useQuery({
		queryKey: ["safety"],
		queryFn: async () => {
			const res = await fetch("/api/users/safety");
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
	});

	const { mutate: savePrivacy } = useMutation({
		mutationFn: (changes) => postJson("/api/users/safety/privacy", changes),
		onSuccess: () => {
			toast.success("Saved");
			queryClient.invalidateQueries({ queryKey: ["safety"] });
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: saveWords } = useMutation({
		mutationFn: (words) => postJson("/api/users/safety/muted-words", { words }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["safety"] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: logout } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/auth/logout", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
		onError: () => toast.error("Logout failed"),
	});

	const addWord = (e) => {
		e.preventDefault();
		const word = newWord.trim().toLowerCase();
		if (!word) return;
		if (safety.mutedWords.includes(word)) return setNewWord("");
		saveWords([...safety.mutedWords, word]);
		setNewWord("");
	};

	if (isLoading) {
		return (
			<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen flex justify-center p-10'>
				<LoadingSpinner size='lg' />
			</div>
		);
	}

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='p-4 border-b border-gray-700'>
				<p className='font-bold'>Settings</p>
				<p className='text-sm text-slate-500'>You decide who reaches you and what you see.</p>
			</div>

			<Section title='Privacy' hint='These rules are enforced by the server, so no one can get around them.'>
				<AudiencePicker
					label='Who can message me'
					value={safety.settings.whoCanMessage}
					onChange={(v) => savePrivacy({ whoCanMessage: v })}
				/>
				<AudiencePicker
					label='Who can reply to my posts'
					value={safety.settings.whoCanReply}
					onChange={(v) => savePrivacy({ whoCanReply: v })}
				/>
			</Section>

			<Section
				title='Muted words'
				hint='Posts containing these words are hidden from your feeds. They still show if you open a profile.'
			>
				<form onSubmit={addWord} className='flex gap-2 mb-3'>
					<input
						type='text'
						className='input input-bordered input-sm rounded-full flex-1'
						placeholder='Add a word or phrase'
						maxLength={40}
						value={newWord}
						onChange={(e) => setNewWord(e.target.value)}
					/>
					<button className='btn btn-primary btn-sm rounded-full text-white'>Add</button>
				</form>
				<div className='flex flex-wrap gap-2'>
					{safety.mutedWords.length === 0 && <p className='text-sm text-slate-500'>No muted words.</p>}
					{safety.mutedWords.map((w) => (
						<span key={w} className='badge badge-lg gap-1'>
							{w}
							<IoCloseSharp
								className='cursor-pointer'
								onClick={() => saveWords(safety.mutedWords.filter((x) => x !== w))}
							/>
						</span>
					))}
				</div>
			</Section>

			<Section title='Muted accounts' hint="You won't see their posts in your feeds. They aren't told.">
				<PeopleList
					people={safety.mutedUsers}
					actionLabel='Unmute'
					onAction={toggleMute}
					emptyText="You haven't muted anyone."
				/>
			</Section>

			<Section title='Blocked accounts' hint='They cannot follow, message or reply to you, and you will not see each other in feeds.'>
				<PeopleList
					people={safety.blockedUsers}
					actionLabel='Unblock'
					onAction={toggleBlock}
					emptyText="You haven't blocked anyone."
				/>
			</Section>

			<Section title='Account'>
				<div className='flex flex-wrap gap-2'>
					<Link to='/bookmarks' className='btn btn-outline btn-sm rounded-full'>
						Saved posts
					</Link>
					<button className='btn btn-outline btn-sm rounded-full' onClick={() => logout()}>
						Log out
					</button>
				</div>
			</Section>
		</div>
	);
};
export default SettingsPage;
