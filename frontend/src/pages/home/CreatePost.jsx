import { CiImageOn } from "react-icons/ci";
import { BsEmojiSmileFill } from "react-icons/bs";
import { useRef, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { compressImage } from "../../utils/image";

const MAX_LENGTH = 500;
const MAX_IMAGES = 4;
const EMOJIS = [
	"😀", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😢", "😭", "😡", "🙏",
	"👍", "👎", "👏", "🙌", "💪", "🔥", "❤️", "💯", "🎉", "✨", "🇳🇬", "🚀",
];

export const OPPORTUNITY_KINDS = [
	{ value: "job", label: "Job" },
	{ value: "freelance", label: "Freelance" },
	{ value: "collaboration", label: "Collaboration" },
	{ value: "project", label: "Project" },
	{ value: "event", label: "Event" },
	{ value: "scholarship", label: "Scholarship" },
	{ value: "competition", label: "Competition" },
	{ value: "business", label: "Business" },
];

const TYPE_HINTS = {
	post: "What is happening?!",
	question: "Ask your question. People can mark replies as helpful, and you can pick a best answer.",
	opportunity: "Describe the opportunity: what it is, who it's for, how to apply.",
	announcement: "Write an announcement for the community.",
};

// props: communitySlug (post goes to this community), canAnnounce (moderators of that community)
const CreatePost = ({ communitySlug, canAnnounce = false }) => {
	const [text, setText] = useState("");
	const [type, setType] = useState("post");
	const [kind, setKind] = useState("job");
	const [location, setLocation] = useState("");
	const [link, setLink] = useState("");
	const [deadline, setDeadline] = useState("");
	const [chosenCommunity, setChosenCommunity] = useState("");
	const [showEmoji, setShowEmoji] = useState(false);
	const [imgs, setImgs] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const imgRef = useRef(null);

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();

	// the communities you can post to (only needed on the home page)
	const { data: myCommunities } = useQuery({
		queryKey: ["myCommunities"],
		queryFn: async () => {
			const res = await fetch("/api/communities/mine");
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		enabled: !communitySlug,
	});

	const targetCommunity = communitySlug || chosenCommunity;

	const {
		mutate: createPost,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: async (payload) => {
			const res = await fetch("/api/posts/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},

		onSuccess: () => {
			setText("");
			setShowEmoji(false);
			setImgs([]);
			setLink("");
			setLocation("");
			setDeadline("");
			setType("post");
			toast.success("Posted");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		if (isPending || isProcessing) return;
		if (!text.trim() && imgs.length === 0) return;
		createPost({
			text,
			imgs,
			type,
			communitySlug: targetCommunity || undefined,
			opportunity: type === "opportunity" ? { kind, location, link, deadline: deadline || undefined } : undefined,
		});
	};

	const handleImgChange = async (e) => {
		const files = Array.from(e.target.files || []);
		e.target.value = null; // lets you pick the same photo again later
		if (files.length === 0) return;

		const room = MAX_IMAGES - imgs.length;
		if (files.length > room) {
			toast.error(`You can attach at most ${MAX_IMAGES} photos`);
		}

		setIsProcessing(true);
		try {
			const added = await Promise.all(
				files
					.filter((f) => f.type.startsWith("image/"))
					.slice(0, room)
					.map((f) => compressImage(f))
			);
			setImgs((current) => [...current, ...added].slice(0, MAX_IMAGES));
		} catch (err) {
			toast.error(err.message);
		} finally {
			setIsProcessing(false);
		}
	};

	const types = [
		{ id: "post", label: "Post" },
		{ id: "question", label: "Question" },
		{ id: "opportunity", label: "Opportunity" },
		...(canAnnounce ? [{ id: "announcement", label: "Announcement" }] : []),
	];

	return (
		<div className='flex p-4 items-start gap-4 border-b border-gray-700'>
			<div className='avatar'>
				<div className='w-8 rounded-full'>
					<img src={authUser.profileImg || "/avatar-placeholder.png"} />
				</div>
			</div>
			<form className='flex flex-col gap-2 w-full min-w-0' onSubmit={handleSubmit}>
				<div className='flex flex-wrap gap-1' role='tablist' aria-label='Post type'>
					{types.map((t) => (
						<button
							key={t.id}
							type='button'
							role='tab'
							aria-selected={type === t.id}
							className={`btn btn-xs rounded-full ${type === t.id ? "btn-primary text-white" : "btn-ghost border border-gray-700"}`}
							onClick={() => setType(t.id)}
						>
							{t.label}
						</button>
					))}
				</div>

				<textarea
					className='textarea w-full p-0 text-lg resize-none border-none focus:outline-none  border-gray-800'
					placeholder={TYPE_HINTS[type]}
					value={text}
					maxLength={MAX_LENGTH}
					onChange={(e) => setText(e.target.value)}
				/>

				{type === "opportunity" && (
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
						<select
							className='select select-bordered select-sm'
							value={kind}
							onChange={(e) => setKind(e.target.value)}
							aria-label='Kind of opportunity'
						>
							{OPPORTUNITY_KINDS.map((k) => (
								<option key={k.value} value={k.value}>
									{k.label}
								</option>
							))}
						</select>
						<input
							type='text'
							className='input input-bordered input-sm'
							placeholder='Location (or "Remote")'
							maxLength={80}
							value={location}
							onChange={(e) => setLocation(e.target.value)}
						/>
						<input
							type='url'
							className='input input-bordered input-sm'
							placeholder='Apply / info link (https://...)'
							maxLength={300}
							value={link}
							onChange={(e) => setLink(e.target.value)}
						/>
						<label className='flex items-center gap-2 text-sm text-slate-400'>
							Deadline
							<input
								type='date'
								className='input input-bordered input-sm flex-1'
								value={deadline}
								onChange={(e) => setDeadline(e.target.value)}
							/>
						</label>
					</div>
				)}

				{imgs.length > 0 && (
					<div className='grid grid-cols-2 gap-2'>
						{imgs.map((src, i) => (
							<div key={i} className='relative'>
								<IoCloseSharp
									className='absolute top-1 right-1 text-white bg-gray-800 rounded-full w-5 h-5 cursor-pointer'
									onClick={() => setImgs((current) => current.filter((_, idx) => idx !== i))}
								/>
								<img src={src} className='w-full h-36 object-cover rounded' />
							</div>
						))}
					</div>
				)}
				{isProcessing && <p className='text-sm text-slate-500'>Preparing photos...</p>}

				<div className='flex justify-between items-center border-t py-2 border-t-gray-700 gap-2'>
					<div className='flex gap-1 items-center'>
						<CiImageOn
							className={`w-6 h-6 ${imgs.length >= MAX_IMAGES ? "fill-gray-600" : "fill-primary cursor-pointer"}`}
							onClick={() => imgs.length < MAX_IMAGES && imgRef.current.click()}
						/>
						<BsEmojiSmileFill
							className='fill-primary w-5 h-5 cursor-pointer'
							onClick={() => setShowEmoji((v) => !v)}
						/>
						{!communitySlug && myCommunities?.length > 0 && (
							<select
								className='select select-bordered select-xs ml-2 max-w-[9rem]'
								value={chosenCommunity}
								onChange={(e) => setChosenCommunity(e.target.value)}
								aria-label='Post to'
							>
								<option value=''>Everyone</option>
								{myCommunities.map((c) => (
									<option key={c._id} value={c.slug}>
										{c.name}
									</option>
								))}
							</select>
						)}
					</div>
					<input type='file' accept='image/*' multiple hidden ref={imgRef} onChange={handleImgChange} />
					<div className='flex items-center gap-3'>
						{text.length > 0 && (
							<span className={`text-xs ${text.length > MAX_LENGTH - 50 ? "text-red-500" : "text-slate-500"}`}>
								{text.length}/{MAX_LENGTH}
							</span>
						)}
						<button
							className='btn btn-primary rounded-full btn-sm text-white px-4'
							disabled={isPending || isProcessing || (!text.trim() && imgs.length === 0)}
						>
							{isPending ? "Posting..." : "Post"}
						</button>
					</div>
				</div>
				{showEmoji && (
					<div className='flex flex-wrap gap-1 p-2 rounded-lg border border-gray-700 bg-[#16181C]'>
						{EMOJIS.map((emoji) => (
							<button
								key={emoji}
								type='button'
								className='text-2xl w-10 h-10 rounded hover:bg-stone-800'
								onClick={() => setText((t) => (t + emoji).slice(0, MAX_LENGTH))}
							>
								{emoji}
							</button>
						))}
					</div>
				)}
				{isError && <div className='text-red-500'>{error.message}</div>}
			</form>
		</div>
	);
};
export default CreatePost;
