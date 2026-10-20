import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Post from "../../components/common/Post";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import { FaArrowLeft } from "react-icons/fa6";

const PostPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();

	const {
		data: post,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["post", id],
		queryFn: async () => {
			const res = await fetch(`/api/posts/${id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		retry: false,
	});

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='flex gap-4 items-center p-4 border-b border-gray-700'>
				<button onClick={() => navigate(-1)} aria-label='Go back'>
					<FaArrowLeft className='w-4 h-4' />
				</button>
				<p className='font-bold'>Post</p>
			</div>

			{isLoading && (
				<div className='flex justify-center p-10'>
					<LoadingSpinner size='lg' />
				</div>
			)}
			{error && (
				<div className='p-6 text-center'>
					<p className='mb-4'>{error.message === "Post not found" ? "This post doesn't exist or was deleted." : error.message}</p>
					<Link to='/' className='btn btn-outline btn-sm rounded-full'>
						Go to home
					</Link>
				</div>
			)}
			{post && <Post post={post} />}
		</div>
	);
};
export default PostPage;
