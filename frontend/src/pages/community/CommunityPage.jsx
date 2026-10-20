import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Posts from "../../components/common/Posts";
import CreatePost from "../home/CreatePost";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import { FaArrowLeft } from "react-icons/fa6";

const api = async (url, method = "GET") => {
	const res = await fetch(url, { method });
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

const PersonRow = ({ user, children }) => (
	<div className='flex gap-3 items-center p-4 border-b border-line'>
		<Link to={`/profile/${user.username}`} className='flex gap-3 items-center flex-1 min-w-0'>
			<div className='avatar'>
				<div className='w-10 rounded-full'>
					<img src={user.profileImg || "/avatar-placeholder.png"} />
				</div>
			</div>
			<div className='min-w-0'>
				<p className='font-bold truncate'>{user.fullName}</p>
				<p className='text-sm text-slate-500 truncate'>@{user.username}</p>
			</div>
		</Link>
		{children}
	</div>
);

const CommunityPage = () => {
	const { slug } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [tab, setTab] = useState("posts");

	const { data: c, isLoading, error } = useQuery({
		queryKey: ["community", slug],
		queryFn: () => api(`/api/communities/${slug}`),
		retry: false,
	});

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["community", slug] });
		queryClient.invalidateQueries({ queryKey: ["communities"] });
		queryClient.invalidateQueries({ queryKey: ["myCommunities"] });
		queryClient.invalidateQueries({ queryKey: ["posts"] });
	};

	const act = (url, message, method = "POST") =>
		api(url, method).then(
			() => {
				if (message) toast.success(message);
				refresh();
				queryClient.invalidateQueries({ queryKey: ["communityPeople"] });
			},
			(e) => toast.error(e.message)
		);

	const isMember = c && ["owner", "moderator", "member"].includes(c.role);
	const isMod = c && (c.role === "owner" || c.role === "moderator");
	const canRead = c && (c.privacy === "open" || isMember);

	const { data: members } = useQuery({
		queryKey: ["communityPeople", slug, "members"],
		queryFn: () => api(`/api/communities/${slug}/members`),
		enabled: tab === "members" && !!canRead,
	});
	const { data: requests } = useQuery({
		queryKey: ["communityPeople", slug, "requests"],
		queryFn: () => api(`/api/communities/${slug}/requests`),
		enabled: tab === "requests" && isMod,
	});

	const { mutate: deleteCommunity } = useMutation({
		mutationFn: () => api(`/api/communities/${slug}`, "DELETE"),
		onSuccess: () => {
			toast.success("Community deleted");
			refresh();
			navigate("/search?tab=communities");
		},
		onError: (e) => toast.error(e.message),
	});

	if (isLoading)
		return (
			<div className='flex-[4_4_0] flex justify-center p-10'>
				<LoadingSpinner size='lg' />
			</div>
		);
	if (error)
		return (
			<div className='flex-[4_4_0] border-l border-r border-line min-h-screen p-6 text-center text-slate-500'>
				{error.message}
				<div className='mt-4'>
					<Link to='/search?tab=communities' className='btn btn-outline btn-sm rounded-full'>
						Browse communities
					</Link>
				</div>
			</div>
		);

	const tabs = [
		["posts", "Posts"],
		["members", "Members"],
		...(isMod ? [["requests", `Requests${c.pendingCount ? ` (${c.pendingCount})` : ""}`]] : []),
		["about", "About"],
	];

	return (
		<div className='flex-[4_4_0] border-l border-r border-line min-h-screen'>
			<div className='flex gap-4 items-center p-4 border-b border-line'>
				<Link to='/search?tab=communities'>
					<FaArrowLeft className='w-4 h-4' />
				</Link>
				<div className='flex flex-col'>
					<p className='font-bold text-lg'>{c.name}</p>
					<span className='text-xs text-slate-500'>
						{c.memberCount} {c.memberCount === 1 ? "member" : "members"} · <span className='capitalize'>{c.category}</span>
						{c.privacy === "request" && " · Private"}
					</span>
				</div>
				<div className='ml-auto'>
					{c.role === "none" && (
						<button
							className='btn btn-primary btn-sm rounded-full text-white'
							onClick={() => act(`/api/communities/${slug}/join`, c.privacy === "request" ? "Request sent" : "Joined")}
						>
							{c.privacy === "request" ? "Request to join" : "Join"}
						</button>
					)}
					{c.role === "pending" && (
						<button className='btn btn-outline btn-sm rounded-full' onClick={() => act(`/api/communities/${slug}/leave`, "Request cancelled")}>
							Requested
						</button>
					)}
					{(c.role === "member" || c.role === "moderator") && (
						<button
							className='btn btn-outline btn-sm rounded-full'
							onClick={() => window.confirm("Leave this community?") && act(`/api/communities/${slug}/leave`, "You left")}
						>
							Joined
						</button>
					)}
				</div>
			</div>

			<div className='flex w-full border-b border-line'>
				{tabs.map(([id, label]) => (
					<button key={id} type='button' onClick={() => setTab(id)} className='flex-1 p-3 hover:bg-secondary transition duration-300 relative text-sm'>
						{label}
						{tab === id && <div className='absolute bottom-0 w-10 h-1 rounded-full bg-primary left-1/2 -translate-x-1/2' />}
					</button>
				))}
			</div>

			{tab === "posts" &&
				(canRead ? (
					<>
						{isMember && <CreatePost communitySlug={slug} canAnnounce={isMod} />}
						<Posts feedType='community' slug={slug} />
					</>
				) : (
					<p className='text-center p-8 text-slate-500'>
						This is a private community. {c.role === "pending" ? "Your request is waiting for approval." : "Request to join to see its posts."}
					</p>
				))}

			{tab === "members" &&
				(canRead ? (
					<>
						{members?.members.map((m) => (
							<PersonRow key={m._id} user={m}>
								{m.role !== "member" && <span className='badge badge-sm capitalize'>{m.role}</span>}
								{c.role === "owner" && m.role !== "owner" && (
									<button className='btn btn-xs btn-outline rounded-full' onClick={() => act(`/api/communities/${slug}/moderators/${m._id}`, "Updated")}>
										{m.role === "moderator" ? "Remove mod" : "Make mod"}
									</button>
								)}
								{isMod && m.role !== "owner" && (c.role === "owner" || m.role === "member") && (
									<button
										className='btn btn-xs btn-outline btn-error rounded-full'
										onClick={() => window.confirm(`Remove @${m.username}?`) && act(`/api/communities/${slug}/members/${m._id}/remove`, "Removed")}
									>
										Remove
									</button>
								)}
							</PersonRow>
						))}
					</>
				) : (
					<p className='text-center p-8 text-slate-500'>Only members can see the member list.</p>
				))}

			{tab === "requests" && isMod && (
				<>
					{requests?.length === 0 && <p className='text-center p-8 text-slate-500'>No pending requests.</p>}
					{requests?.map((u) => (
						<PersonRow key={u._id} user={u}>
							<button className='btn btn-xs btn-primary rounded-full text-white' onClick={() => act(`/api/communities/${slug}/requests/${u._id}/approve`, "Approved")}>
								Approve
							</button>
							<button className='btn btn-xs btn-outline rounded-full' onClick={() => act(`/api/communities/${slug}/requests/${u._id}/reject`, "Declined")}>
								Decline
							</button>
						</PersonRow>
					))}
				</>
			)}

			{tab === "about" && (
				<div className='p-4 flex flex-col gap-4'>
					<p>{c.description || "No description yet."}</p>
					<div>
						<p className='font-bold mb-1'>Rules</p>
						{c.rules?.length ? (
							<ol className='list-decimal pl-5 text-sm flex flex-col gap-1'>
								{c.rules.map((r, i) => (
									<li key={i}>{r}</li>
								))}
							</ol>
						) : (
							<p className='text-sm text-slate-500'>No rules set.</p>
						)}
					</div>
					<div className='text-sm text-slate-400'>
						Owner: <Link className='text-sky-400' to={`/profile/${c.owner.username}`}>@{c.owner.username}</Link>
						{c.moderators?.length > 0 && (
							<> · Moderators: {c.moderators.map((m) => (
								<Link key={m._id} className='text-sky-400 mr-1' to={`/profile/${m.username}`}>@{m.username}</Link>
							))}</>
						)}
					</div>
					{c.role === "owner" && (
						<button
							className='btn btn-outline btn-error btn-sm rounded-full w-fit'
							onClick={() => window.confirm("Delete this community and all its posts? This cannot be undone.") && deleteCommunity()}
						>
							Delete community
						</button>
					)}
				</div>
			)}
		</div>
	);
};
export default CommunityPage;
