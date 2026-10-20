import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

const REASONS = [
	["spam", "Spam or fake engagement"],
	["harassment", "Harassment or bullying"],
	["hate", "Hate or discrimination"],
	["scam", "Scam or fraud"],
	["nudity", "Nudity or sexual content"],
	["violence", "Violence or threats"],
	["misinformation", "Harmful misinformation"],
	["other", "Something else"],
];

// target = { type: "post" | "user", id } ; shows nothing when target is null
const ReportDialog = ({ target, onClose }) => {
	const [reason, setReason] = useState("");
	const [details, setDetails] = useState("");

	const { mutate, isPending } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetType: target.type, targetId: target.id, reason, details }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (data) => {
			toast.success(data.message);
			setReason("");
			setDetails("");
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	if (!target) return null;

	return (
		<div className='fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4' onClick={onClose}>
			<div
				className='bg-base-100 border border-gray-700 rounded-2xl w-full max-w-md p-5 flex flex-col gap-3'
				onClick={(e) => e.stopPropagation()}
			>
				<p className='font-bold text-lg'>Report {target.type === "post" ? "this post" : "this account"}</p>
				<p className='text-sm text-slate-400'>Pick the closest reason. Only our team will see your report.</p>
				<div className='flex flex-col gap-2'>
					{REASONS.map(([value, label]) => (
						<label key={value} className='flex gap-2 items-center cursor-pointer'>
							<input type='radio' name='reason' className='radio radio-sm' checked={reason === value} onChange={() => setReason(value)} />
							<span>{label}</span>
						</label>
					))}
				</div>
				<textarea
					className='textarea textarea-bordered'
					rows={3}
					maxLength={500}
					placeholder='Anything else we should know? (optional)'
					value={details}
					onChange={(e) => setDetails(e.target.value)}
				/>
				<div className='flex gap-2 justify-end'>
					<button type='button' className='btn btn-outline btn-sm rounded-full' onClick={onClose}>
						Cancel
					</button>
					<button
						type='button'
						className='btn btn-primary btn-sm rounded-full text-white'
						disabled={!reason || isPending}
						onClick={() => mutate()}
					>
						{isPending ? "Sending..." : "Send report"}
					</button>
				</div>
			</div>
		</div>
	);
};
export default ReportDialog;
