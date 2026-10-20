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

const CreatePost = () => {
	const [text, setText] = useState("");
	const [showEmoji, setShowEmoji] = useState(false);
	const [imgs, setImgs] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const imgRef = useRef(null);

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();

	const {
		mutate: createPost,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: async ({ text, imgs }) => {
			try {
				const res = await fetch("/api/posts/create", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ text, imgs }),
				});
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				return data;
			} catch (error) {
				throw new Error(error);
			}
		},

		onSuccess: () => {
			setText("");
			setShowEmoji(false);
			setImgs([]);
			toast.success("Post created successfully");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		if (isPending) return;
		if (isProcessing) return;
		if (!text.trim() && imgs.length === 0) return;
		createPost({ text, imgs });
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
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<div className='flex p-4 items-start gap-4 border-b border-gray-700'>
			<div className='avatar'>
				<div className='w-8 rounded-full'>
					<img src={authUser.profileImg || "/avatar-placeholder.png"} />
				</div>
			</div>
			<form className='flex flex-col gap-2 w-full' onSubmit={handleSubmit}>
				<textarea
					className='textarea w-full p-0 text-lg resize-none border-none focus:outline-none  border-gray-800'
					placeholder='What is happening?!'
					value={text}
					maxLength={MAX_LENGTH}
					onChange={(e) => setText(e.target.value)}
				/>
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

				<div className='flex justify-between border-t py-2 border-t-gray-700'>
					<div className='flex gap-1 items-center'>
						<CiImageOn
							className={`w-6 h-6 ${imgs.length >= MAX_IMAGES ? "fill-gray-600" : "fill-primary cursor-pointer"}`}
							onClick={() => imgs.length < MAX_IMAGES && imgRef.current.click()}
						/>
						<BsEmojiSmileFill
							className='fill-primary w-5 h-5 cursor-pointer'
							onClick={() => setShowEmoji((v) => !v)}
						/>
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
