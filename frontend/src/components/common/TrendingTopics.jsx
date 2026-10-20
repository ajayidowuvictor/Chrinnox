import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

// shows the most-used topics of the last 7 days (real data); renders nothing if there are none
const TrendingTopics = ({ className = "" }) => {
	const { data: topics } = useQuery({
		queryKey: ["trendingTopics"],
		queryFn: async () => {
			const res = await fetch("/api/topics/trending");
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Something went wrong");
			return json;
		},
		staleTime: 60 * 1000,
	});

	if (!topics || topics.length === 0) return null;

	return (
		<div className={className}>
			<p className='font-bold mb-2'>Trending topics</p>
			<div className='flex flex-col'>
				{topics.map((t) => (
					<Link
						key={t.topic}
						to={`/topic/${encodeURIComponent(t.topic)}`}
						className='py-1.5 hover:bg-stone-900 rounded px-1 -mx-1'
					>
						<p className='font-semibold'>#{t.topic}</p>
						<p className='text-xs text-slate-500'>
							{t.count} {t.count === 1 ? "post" : "posts"} this week
						</p>
					</Link>
				))}
			</div>
		</div>
	);
};
export default TrendingTopics;
