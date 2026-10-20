import { useInfiniteQuery } from "@tanstack/react-query";

import EventCard from "./EventCard";
import LoadingSpinner from "./LoadingSpinner";

// when: upcoming | past | going | hosting ; community: slug (optional); q: search text
const EventsList = ({ when = "upcoming", q = "", community = "" }) => {
	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
		queryKey: ["events", when, q, community],
		initialPageParam: 1,
		queryFn: async ({ pageParam }) => {
			const params = new URLSearchParams({ when, page: pageParam });
			if (q) params.set("q", q);
			if (community) params.set("community", community);
			const res = await fetch(`/api/events?${params}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Something went wrong");
			return json;
		},
		getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
	});

	if (isLoading)
		return (
			<div className='flex justify-center p-6'>
				<LoadingSpinner size='lg' />
			</div>
		);
	if (error)
		return (
			<div className='text-center p-6'>
				<p className='mb-3'>Couldn&apos;t load events. {error.message}</p>
				<button className='btn btn-outline btn-sm rounded-full' onClick={() => refetch()}>
					Try again
				</button>
			</div>
		);

	const events = (data?.pages ?? []).flatMap((p) => p.events);
	if (events.length === 0) {
		const text = {
			upcoming: "No upcoming events. Why not host one?",
			past: "No past events.",
			going: "You haven't RSVP'd to anything yet.",
			hosting: "You aren't hosting anything coming up.",
		}[when];
		return <p className='text-center p-8 text-slate-500'>{text}</p>;
	}

	return (
		<div>
			{events.map((e) => (
				<EventCard key={e._id} event={e} />
			))}
			{hasNextPage && (
				<div className='flex justify-center p-4'>
					<button className='btn btn-outline btn-sm rounded-full' onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
						{isFetchingNextPage ? "Loading..." : "Show more"}
					</button>
				</div>
			)}
		</div>
	);
};
export default EventsList;
