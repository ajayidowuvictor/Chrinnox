import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

const ForgotPasswordPage = () => {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);

	const { mutate, isPending } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: () => setSent(true),
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className='max-w-md mx-auto w-full min-h-screen flex flex-col justify-center p-6 gap-4'>
			<h1 className='text-3xl font-extrabold'>Forgot your password?</h1>
			{sent ? (
				<>
					<p>If that email has an account, we&apos;ve sent a link to reset the password. It works for one hour.</p>
					<p className='text-sm text-slate-500'>Nothing in your inbox? Check spam, or try again in a few minutes.</p>
				</>
			) : (
				<form
					className='flex flex-col gap-4'
					onSubmit={(e) => {
						e.preventDefault();
						mutate();
					}}
				>
					<p className='text-slate-400'>Type the email you signed up with and we&apos;ll send you a reset link.</p>
					<input
						type='email'
						className='input input-bordered'
						placeholder='Email'
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoFocus
					/>
					<button className='btn btn-primary rounded-full text-white' disabled={isPending || !email.trim()}>
						{isPending ? "Sending..." : "Send reset link"}
					</button>
				</form>
			)}
			<Link to='/login' className='text-sky-400 text-sm'>
				Back to login
			</Link>
		</div>
	);
};
export default ForgotPasswordPage;
