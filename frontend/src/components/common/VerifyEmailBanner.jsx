import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

// shown only while the signed-in person's email is unconfirmed
const VerifyEmailBanner = () => {
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const { mutate, isPending } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/auth/resend-verification", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (d) => toast.success(d.message),
		onError: (e) => toast.error(e.message),
	});

	if (!authUser || authUser.emailVerified) return null;
	return (
		<div className='flex gap-3 items-center p-3 border-b border-line bg-amber-500/10 text-sm'>
			<span className='flex-1'>
				Confirm your email so you can recover your account if you forget your password.
			</span>
			<button className='btn btn-xs btn-outline rounded-full' disabled={isPending} onClick={() => mutate()}>
				{isPending ? "Sending..." : "Send link"}
			</button>
		</div>
	);
};
export default VerifyEmailBanner;
