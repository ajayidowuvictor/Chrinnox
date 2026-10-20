import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

const ResetPasswordPage = () => {
	const { token } = useParams();
	const navigate = useNavigate();
	const [password, setPassword] = useState("");
	const [again, setAgain] = useState("");

	const { mutate, isPending, error } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (d) => {
			toast.success(d.message);
			navigate("/login");
		},
	});

	const mismatch = again.length > 0 && again !== password;

	return (
		<div className='max-w-md mx-auto w-full min-h-screen flex flex-col justify-center p-6 gap-4'>
			<h1 className='text-3xl font-extrabold'>Choose a new password</h1>
			<form
				className='flex flex-col gap-4'
				onSubmit={(e) => {
					e.preventDefault();
					if (!mismatch) mutate();
				}}
			>
				<input
					type='password'
					className='input input-bordered'
					placeholder='New password (at least 6 characters)'
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					minLength={6}
					required
					autoFocus
				/>
				<input
					type='password'
					className='input input-bordered'
					placeholder='Type it again'
					value={again}
					onChange={(e) => setAgain(e.target.value)}
					required
				/>
				{mismatch && <p className='text-red-500 text-sm'>The two passwords don&apos;t match.</p>}
				{error && <p className='text-red-500 text-sm'>{error.message}</p>}
				<button className='btn btn-primary rounded-full text-white' disabled={isPending || mismatch || password.length < 6}>
					{isPending ? "Saving..." : "Change password"}
				</button>
			</form>
			<Link to='/forgot-password' className='text-sky-400 text-sm'>
				Link expired? Get a new one
			</Link>
		</div>
	);
};
export default ResetPasswordPage;
