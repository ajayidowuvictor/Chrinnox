import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import Posts from "../../components/common/Posts";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import { FaArrowLeft } from "react-icons/fa6";

const TopicPage = () => {
	const { name } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const topic = decodeURIComponent(name).toLowerCase();

	const { data, isLoading, error } = useQuery({
		queryKey: ["topic", topic],
		queryFn: async () => {
			const res = await fetch(`/api/topics/${encodeURIComponent(topic)}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Something went wrong");
			return json;
		},
		retry: false,
	});

	const { mutate: toggleFollow, isPending } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/topics/${encodeURIComponent(topic)}/follow`, { method: "POST" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Something went wrong");
			return json;
		},
		onSuccess: (json) => {
			toast.success(json.following ? `You follow #${topic}` : `Unfollowed #${topic}`);
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
			queryClient.invalidateQueries({ queryKey: ["topic", topic] });
			queryClient.invalidateQueries({ queryKey: ["posts", "topics"] });
		},
		onError: (e) => toast.error(e.message),
	});

	const isFollowing = (authUser?.followedTopics || []).includes(topic);

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='flex gap-4 items-center p-4 border-b border-gray-700'>
				<button onClick={() => navigate(-1)} aria-label='Go back'>
					<FaArrowLeft className='w-4 h-4' />
				</button>
				<div className='flex-1 min-w-0'>
					<p className='font-bold text-lg truncate'>#{topic}</p>
					{data && (
						<p className='text-sm text-slate-500'>
							{data.postCount} {data.postCount === 1 ? "post" : "posts"} · {data.followerCount}{" "}
							{data.followerCount === 1 ? "follower" : "followers"}
						</p>
					)}
				</div>
				<button
					className={`btn btn-sm rounded-full ${isFollowing ? "btn-outline" : "btn-primary text-white"}`}
					onClick={() => toggleFollow()}
					disabled={isPending}
				>
					{isFollowing ? "Following" : "Follow topic"}
				</button>
			</div>

			{isLoading && (
				<div className='flex justify-center p-6'>
					<LoadingSpinner size='lg' />
				</div>
			)}
			{error ? (
				<div className='p-6 text-center'>
					<p className='mb-3'>That topic isn&apos;t valid.</p>
					<Link to='/' className='btn btn-outline btn-sm rounded-full'>
						Go home
					</Link>
				</div>
			) : (
				<Posts feedType='topic' topic={topic} />
			)}
		</div>
	);
};
export default TopicPage;
