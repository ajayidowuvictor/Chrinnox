import { Link } from "react-router-dom";

// shows a post's text and turns #hashtags into links to topic pages
const PostText = ({ text }) => {
	if (!text) return null;
	const parts = text.split(/(#[\p{L}\p{N}_]{2,30})/gu);
	return (
		<span className='whitespace-pre-wrap break-words'>
			{parts.map((part, i) =>
				part.startsWith("#") && part.length > 1 ? (
					<Link
						key={i}
						to={`/topic/${encodeURIComponent(part.slice(1).toLowerCase())}`}
						className='text-sky-500 hover:underline'
					>
						{part}
					</Link>
				) : (
					part
				)
			)}
		</span>
	);
};
export default PostText;
