import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import Post from "./Post";
import PostSkeleton from "../skeletons/PostSkeleton";
import LoadingSpinner from "./LoadingSpinner";

// feeds that the server splits into pages
const PAGED = ["forYou", "following", "latest", "discussions", "topics", "topic", "community", "opportunities"];

const EMPTY_TEXT = {
	following: "Nothing here yet. Follow some people and their posts will show up here.",
	discussions: "No active discussions yet. Reply to a post to start one.",
	latest: "No posts yet. Be the first to post.",
	forYou: "No posts yet. Be the first to post.",
	topic: "No posts in this topic yet. Be the first.",
	community: "No posts here yet. Start the conversation.",
	opportunities: "No open opportunities match. Try another filter, or post one yourself.",
	posts: "No posts here yet.",
	likes: "No liked posts yet.",
	bookmarks: "You haven't saved anything yet. Tap the bookmark on a post to keep it here.",
};

const Posts = ({ feedType, username, userId, topic, slug, kind, q }) => {
	const getEndpoint = (page) => {
		if (feedType === "community") return `/api/posts/feed?mode=community&community=${encodeURIComponent(slug)}&page=${page}`;
		if (feedType === "opportunities") {
			const params = new URLSearchParams({ page });
			if (kind) params.set("kind", kind);
			if (q) params.set("q", q);
			return `/api/posts/opportunities?${params}`;
		}
		if (feedType === "topic") return `/api/posts/feed?mode=topic&topic=${encodeURIComponent(topic)}&page=${page}`;
		if (PAGED.includes(feedType)) return `/api/posts/feed?mode=${feedType}&page=${page}`;
		if (feedType === "posts") return `/api/posts/user/${username}`;
		if (feedType === "likes") return `/api/posts/likes/${userId}`;
		if (feedType === "bookmarks") return "/api/posts/bookmarks";
		return `/api/posts/feed?mode=forYou&page=${page}`;
	};

	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
		queryKey: ["posts", feedType, username, userId, topic, slug, kind, q],
		initialPageParam: 1,
		queryFn: async ({ pageParam }) => {
			const res = await fetch(getEndpoint(pageParam));
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Something went wrong");
			// older endpoints return a plain list: treat it as a single page
			return Array.isArray(json) ? { posts: json, hasMore: false } : json;
		},
		getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
	});

	// load the next page when the bottom of the list comes into view
	const sentinelRef = useRef(null);
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !hasNextPage) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
			},
			{ rootMargin: "400px" }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// pages can overlap when new posts arrive, so remove repeats
	const seen = new Set();
	const posts = (data?.pages ?? [])
		.flatMap((p) => p.posts)
		.filter((p) => (seen.has(p._id) ? false : seen.add(p._id)));

	if (isLoading) {
		return (
			<div className='flex flex-col justify-center'>
				<PostSkeleton />
				<PostSkeleton />
				<PostSkeleton />
			</div>
		);
	}

	if (error) {
		return (
			<div className='text-center my-6'>
				<p className='mb-3'>Couldn&apos;t load posts. {error.message}</p>
				<button className='btn btn-outline btn-sm rounded-full' onClick={() => refetch()}>
					Try again
				</button>
			</div>
		);
	}

	if (feedType === "topics" && data?.pages?.[0]?.needsTopics) {
		return (
			<p className='text-center my-6 px-6'>
				You aren&apos;t following any topics yet. Tap a <span className='text-sky-500'>#hashtag</span> in any post,
				or look at trending topics in Search, then press <b>Follow</b>.
			</p>
		);
	}

	if (posts.length === 0) {
		return <p className='text-center my-6 px-6 text-slate-400'>{EMPTY_TEXT[feedType] || "Nothing here yet."}</p>;
	}

	return (
		<div>
			{posts.map((post) => (
				<Post key={post._id} post={post} />
			))}
			<div ref={sentinelRef} className='py-6 flex justify-center'>
				{isFetchingNextPage && <LoadingSpinner size='md' />}
				{hasNextPage && !isFetchingNextPage && (
					<button className='btn btn-outline btn-sm rounded-full' onClick={() => fetchNextPage()}>
						Load more
					</button>
				)}
				{!hasNextPage && posts.length > 8 && <p className='text-sm text-slate-500'>You&apos;re all caught up</p>}
			</div>
		</div>
	);
};
export default Posts;
