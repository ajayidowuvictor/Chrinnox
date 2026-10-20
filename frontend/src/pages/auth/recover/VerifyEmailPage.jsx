import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import LoadingSpinner from "../../../components/common/LoadingSpinner";

const VerifyEmailPage = () => {
	const { token } = useParams();
	const queryClient = useQueryClient();
	const [state, setState] = useState({ status: "working", message: "" });
	const started = useRef(false); // the link is single-use, so only try once

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		fetch("/api/auth/verify-email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
		})
			.then(async (res) => {
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Something went wrong");
				setState({ status: "ok", message: data.message });
				queryClient.invalidateQueries({ queryKey: ["authUser"] });
			})
			.catch((e) => setState({ status: "error", message: e.message }));
	}, [token, queryClient]);

	return (
		<div className='max-w-md mx-auto w-full min-h-screen flex flex-col justify-center items-center p-6 gap-4 text-center'>
			{state.status === "working" && <LoadingSpinner size='lg' />}
			{state.status === "ok" && <h1 className='text-2xl font-extrabold'>Email confirmed ✅</h1>}
			{state.status === "error" && (
				<>
					<h1 className='text-2xl font-extrabold'>Couldn&apos;t confirm</h1>
					<p className='text-slate-400'>{state.message}</p>
				</>
			)}
			<Link to='/' className='btn btn-primary rounded-full text-white'>
				Go to Chrinnox
			</Link>
		</div>
	);
};
export default VerifyEmailPage;
