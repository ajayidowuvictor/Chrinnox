import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { FaArrowLeft } from "react-icons/fa6";
import { CATEGORIES } from "../search/CommunitiesTab";

const CreateCommunityPage = () => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [form, setForm] = useState({ name: "", description: "", category: "other", privacy: "open", rules: "" });

	const { mutate, isPending } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/communities", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...form, rules: form.rules.split("\n").map((r) => r.trim()).filter(Boolean) }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		onSuccess: (c) => {
			toast.success("Community created");
			queryClient.invalidateQueries({ queryKey: ["communities"] });
			queryClient.invalidateQueries({ queryKey: ["myCommunities"] });
			navigate(`/c/${c.slug}`);
		},
		onError: (e) => toast.error(e.message),
	});

	const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='flex gap-4 items-center p-4 border-b border-gray-700'>
				<Link to='/search?tab=communities'>
					<FaArrowLeft className='w-4 h-4' />
				</Link>
				<p className='font-bold text-lg'>Create a community</p>
			</div>
			<form
				className='p-4 flex flex-col gap-4'
				onSubmit={(e) => {
					e.preventDefault();
					mutate();
				}}
			>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Name (3 to 40 characters)</span>
					<input className='input input-bordered' maxLength={40} value={form.name} onChange={set("name")} required />
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>What is it about? (up to 300 characters)</span>
					<textarea className='textarea textarea-bordered' maxLength={300} rows={3} value={form.description} onChange={set("description")} />
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Category</span>
					<select className='select select-bordered capitalize' value={form.category} onChange={set("category")}>
						{CATEGORIES.map((c) => (
							<option key={c} value={c}>{c}</option>
						))}
					</select>
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Who can join?</span>
					<select className='select select-bordered' value={form.privacy} onChange={set("privacy")}>
						<option value='open'>Anyone can join and read</option>
						<option value='request'>Private: people ask to join, only members can read</option>
					</select>
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-sm text-slate-400'>Rules (one per line, up to 10)</span>
					<textarea className='textarea textarea-bordered' rows={4} value={form.rules} onChange={set("rules")} />
				</label>
				<button className='btn btn-primary rounded-full text-white' disabled={isPending || form.name.trim().length < 3}>
					{isPending ? "Creating..." : "Create community"}
				</button>
			</form>
		</div>
	);
};
export default CreateCommunityPage;
