import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import toast from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";

// starting points only; each one is a normal topic anyone can follow
const STARTER_TOPICS = [
	"technology", "business", "jobs", "freelance", "startups", "design",
	"education", "careers", "gaming", "music", "sports", "football", "lagos", "nigeria",
];

const call = async (url, method = "GET") => {
	const res = await fetch(url, { method });
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

const Chip = ({ active, onClick, children }) => (
	<button
		type='button'
		onClick={onClick}
		className={`btn btn-sm rounded-full ${active ? "btn-primary text-white" : "btn-outline"}`}
	>
		{children}
	</button>
);

const WelcomePage = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const [joined, setJoined] = useState({}); // slug -> role, as answered by the server

	const { data: trending } = useQuery({ queryKey: ["trendingTopics"], queryFn: () => call("/api/topics/trending") });
	const { data: communities, isLoading: loadingC } = useQuery({
		queryKey: ["welcomeCommunities"],
		queryFn: () => call("/api/communities"),
		staleTime: Infinity,
	});
	const { data: people, isLoading: loadingP } = useQuery({
		queryKey: ["welcomePeople"],
		queryFn: () => call("/api/users/suggested"),
		staleTime: Infinity,
	});

	const topics = [...new Set([...(trending || []).map((t) => t.topic), ...STARTER_TOPICS])].slice(0, 20);
	const followedTopics = authUser?.followedTopics || [];

	const refreshMe = () => queryClient.invalidateQueries({ queryKey: ["authUser"] });

	const { mutate: toggleTopic } = useMutation({
		mutationFn: (t) => call(`/api/topics/${encodeURIComponent(t)}/follow`, "POST"),
		onSuccess: refreshMe,
		onError: (e) => toast.error(e.message),
	});
	const { mutate: toggleFollow } = useMutation({
		mutationFn: (id) => call(`/api/users/follow/${id}`, "POST"),
		onSuccess: refreshMe,
		onError: (e) => toast.error(e.message),
	});
	const { mutate: join } = useMutation({
		mutationFn: ({ slug }) => call(`/api/communities/${slug}/join`, "POST"),
		onSuccess: (data, { slug }) => setJoined((j) => ({ ...j, [slug]: data.role })),
		onError: (e) => toast.error(e.message),
	});
	const { mutate: finish, isPending: finishing } = useMutation({
		mutationFn: () => call("/api/users/onboarding-complete", "POST"),
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["myCommunities"] });
			await refreshMe();
			navigate("/");
		},
		onError: (e) => toast.error(e.message),
	});

	if (!authUser) return null;

	const roleOf = (c) => joined[c.slug] ?? c.role;
	const isIn = (c) => ["owner", "moderator", "member"].includes(roleOf(c));
	const openCommunities = (communities?.communities || []).filter((c) => c.privacy === "open").slice(0, 8);

	return (
		<div className='flex-[4_4_0] border-l border-r border-line min-h-screen'>
			<div className='p-6 border-b border-line'>
				<h1 className='text-2xl font-extrabold'>Welcome to Chrinnox, {authUser.fullName.split(" ")[0]} 👋</h1>
				<p className='text-slate-400 mt-1'>
					Pick a few things you care about so your feed isn&apos;t empty. You can change all of this later.
				</p>
			</div>

			<section className='p-4 border-b border-line'>
				<h2 className='font-bold text-lg mb-1'>Topics</h2>
				<p className='text-sm text-slate-500 mb-3'>Posts about these will be boosted in your feed.</p>
				<div className='flex flex-wrap gap-2'>
					{topics.map((t) => (
						<Chip key={t} active={followedTopics.includes(t)} onClick={() => toggleTopic(t)}>
							#{t}
						</Chip>
					))}
				</div>
			</section>

			<section className='p-4 border-b border-line'>
				<h2 className='font-bold text-lg mb-1'>Communities</h2>
				<p className='text-sm text-slate-500 mb-3'>Groups to join. You can always find more in Explore.</p>
				{loadingC && <LoadingSpinner />}
				{!loadingC && openCommunities.length === 0 && (
					<p className='text-sm text-slate-500'>No communities yet. You could start the first one from Explore.</p>
				)}
				{openCommunities.map((c) => (
					<div key={c._id} className='flex items-center gap-3 py-2'>
						<div className='flex-1 min-w-0'>
							<p className='font-semibold truncate'>{c.name}</p>
							<p className='text-xs text-slate-500 truncate capitalize'>
								{c.category} · {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
							</p>
						</div>
						{isIn(c) ? (
							<span className='badge badge-success'>Joined</span>
						) : (
							<button className='btn btn-outline btn-sm rounded-full' onClick={() => join({ slug: c.slug })}>
								Join
							</button>
						)}
					</div>
				))}
			</section>

			<section className='p-4 border-b border-line'>
				<h2 className='font-bold text-lg mb-1'>People</h2>
				<p className='text-sm text-slate-500 mb-3'>Follow a few people to fill your Following feed.</p>
				{loadingP && <LoadingSpinner />}
				{!loadingP && (people || []).length === 0 && (
					<p className='text-sm text-slate-500'>No one to suggest yet. You&apos;ll find people in Explore.</p>
				)}
				{(people || []).map((u) => {
					const following = (authUser.following || []).includes(u._id);
					return (
						<div key={u._id} className='flex items-center gap-3 py-2'>
							<div className='avatar'>
								<div className='w-9 rounded-full'>
									<img src={u.profileImg || "/avatar-placeholder.png"} />
								</div>
							</div>
							<div className='flex-1 min-w-0'>
								<p className='font-semibold truncate'>{u.fullName}</p>
								<p className='text-xs text-slate-500 truncate'>@{u.username}</p>
							</div>
							<button
								className={`btn btn-sm rounded-full ${following ? "btn-outline" : "btn-primary text-white"}`}
								onClick={() => toggleFollow(u._id)}
							>
								{following ? "Following" : "Follow"}
							</button>
						</div>
					);
				})}
			</section>

			<div className='p-4 flex gap-3 justify-end sticky bottom-0 bg-base-100 border-t border-line pb-20 md:pb-4'>
				<button className='btn btn-ghost btn-sm' onClick={() => finish()} disabled={finishing}>
					Skip for now
				</button>
				<button className='btn btn-primary rounded-full text-white' onClick={() => finish()} disabled={finishing}>
					{finishing ? "One moment..." : "Take me to my feed"}
				</button>
			</div>
		</div>
	);
};
export default WelcomePage;
