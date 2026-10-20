import { useState } from "react";

import Posts from "../../components/common/Posts";
import CreatePost from "./CreatePost";

const FEEDS = [
	{ id: "forYou", label: "For you", hint: "Useful, active and fresh posts, with people and topics you follow boosted" },
	{ id: "following", label: "Following", hint: "Only people you follow, newest first" },
	{ id: "latest", label: "Latest", hint: "Everything, newest first, no ranking" },
	{ id: "discussions", label: "Discussions", hint: "Posts with the most active conversations" },
	{ id: "topics", label: "Topics", hint: "Posts about the topics you follow" },
];

const readSaved = () => {
	try {
		const saved = localStorage.getItem("chrinnox-feed");
		return FEEDS.some((f) => f.id === saved) ? saved : "forYou";
	} catch {
		return "forYou";
	}
};

const HomePage = () => {
	const [feedType, setFeedType] = useState(readSaved);

	const choose = (id) => {
		setFeedType(id);
		try {
			localStorage.setItem("chrinnox-feed", id);
		} catch {
			/* storage may be blocked; the choice just won't be remembered */
		}
	};

	const current = FEEDS.find((f) => f.id === feedType);

	return (
		<>
			<div className='flex-[4_4_0] mr-auto border-r border-gray-700 min-h-screen min-w-0'>
				{/* Feed modes: you choose how your feed works */}
				<div className='flex w-full border-b border-gray-700 overflow-x-auto' role='tablist'>
					{FEEDS.map((feed) => (
						<button
							key={feed.id}
							role='tab'
							aria-selected={feedType === feed.id}
							title={feed.hint}
							className='flex justify-center flex-1 min-w-fit px-4 py-3 hover:bg-secondary transition duration-300 cursor-pointer relative whitespace-nowrap'
							onClick={() => choose(feed.id)}
						>
							<span className={feedType === feed.id ? "font-bold" : "text-slate-400"}>{feed.label}</span>
							{feedType === feed.id && (
								<div className='absolute bottom-0 w-10 h-1 rounded-full bg-primary'></div>
							)}
						</button>
					))}
				</div>
				<p className='px-4 py-1 text-xs text-slate-500 border-b border-gray-700'>{current.hint}</p>

				{/*  CREATE POST INPUT */}
				<CreatePost />

				{/* POSTS */}
				<Posts feedType={feedType} />
			</div>
		</>
	);
};
export default HomePage;
