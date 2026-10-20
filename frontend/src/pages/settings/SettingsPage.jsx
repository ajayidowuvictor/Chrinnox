import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import useSafetyActions from "../../hooks/useSafetyActions";
import { canPromptInstall, isInstalled, isIos, promptInstall, subscribeInstall } from "../../utils/install";
import { currentSubscription, disablePush, enablePush, pushSupported } from "../../utils/push";
import { getThemePreference, setThemePreference } from "../../utils/theme";

import { IoCloseSharp } from "react-icons/io5";

const OPTIONS = [
	{ value: "everyone", label: "Everyone" },
	{ value: "following", label: "People I follow" },
	{ value: "nobody", label: "Nobody" },
];

const postJson = async (url, body) => {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

const Section = ({ title, hint, children }) => (
	<section className='p-4 border-b border-line'>
		<h2 className='font-bold text-lg'>{title}</h2>
		{hint && <p className='text-sm text-slate-500 mb-3'>{hint}</p>}
		{children}
	</section>
);

const AudiencePicker = ({ label, value, onChange }) => (
	<div className='mb-4'>
		<p className='mb-1 font-semibold'>{label}</p>
		<div className='join flex-wrap'>
			{OPTIONS.map((o) => (
				<button
					key={o.value}
					className={`btn btn-sm join-item ${value === o.value ? "btn-primary text-white" : "btn-outline"}`}
					onClick={() => onChange(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	</div>
);

const PeopleList = ({ people, actionLabel, onAction, emptyText }) => (
	<>
		{people.length === 0 && <p className='text-sm text-slate-500'>{emptyText}</p>}
		{people.map((u) => (
			<div key={u._id} className='flex items-center gap-3 py-2'>
				<div className='avatar'>
					<div className='w-9 rounded-full'>
						<img src={u.profileImg || "/avatar-placeholder.png"} />
					</div>
				</div>
				<Link to={`/profile/${u.username}`} className='flex-1 min-w-0'>
					<p className='font-bold truncate'>{u.fullName}</p>
					<p className='text-sm text-slate-500 truncate'>@{u.username}</p>
				</Link>
				<button className='btn btn-outline btn-sm rounded-full' onClick={() => onAction(u._id)}>
					{actionLabel}
				</button>
			</div>
		))}
	</>
);

const SecurityForms = () => {
	const queryClient = useQueryClient();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const [pw, setPw] = useState({ current: "", next: "", again: "" });
	const [mail, setMail] = useState({ email: "", current: "" });

	const send = async (body) => {
		const res = await fetch("/api/users/update", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Something went wrong");
		return data;
	};

	const { mutate: changePassword, isPending: changingPw } = useMutation({
		mutationFn: () => send({ currentPassword: pw.current, newPassword: pw.next }),
		onSuccess: () => {
			toast.success("Password changed. Other devices were signed out.");
			setPw({ current: "", next: "", again: "" });
		},
		onError: (e) => toast.error(e.message),
	});

	const { mutate: changeEmail, isPending: changingMail } = useMutation({
		mutationFn: () => send({ email: mail.email, currentPassword: mail.current }),
		onSuccess: () => {
			toast.success("Email changed. We sent a link to confirm it.");
			setMail({ email: "", current: "" });
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
		},
		onError: (e) => toast.error(e.message),
	});

	const mismatch = pw.again.length > 0 && pw.again !== pw.next;

	return (
		<>
			<Section title='Change password'>
				<form
					className='flex flex-col gap-3 max-w-sm'
					onSubmit={(e) => {
						e.preventDefault();
						if (!mismatch) changePassword();
					}}
				>
					<input type='password' className='input input-bordered input-sm' placeholder='Current password' value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
					<input type='password' className='input input-bordered input-sm' placeholder='New password (at least 6 characters)' minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
					<input type='password' className='input input-bordered input-sm' placeholder='New password again' value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required />
					{mismatch && <p className='text-red-500 text-sm'>The two new passwords don&apos;t match.</p>}
					<button className='btn btn-primary btn-sm rounded-full text-white w-fit' disabled={changingPw || mismatch || pw.next.length < 6 || !pw.current}>
						{changingPw ? "Saving..." : "Change password"}
					</button>
				</form>
			</Section>

			<Section
				title='Email address'
				hint={`Now: ${authUser?.email || ""} ${authUser?.emailVerified ? "(confirmed)" : "(not confirmed yet)"}`}
			>
				<form
					className='flex flex-col gap-3 max-w-sm'
					onSubmit={(e) => {
						e.preventDefault();
						changeEmail();
					}}
				>
					<input type='email' className='input input-bordered input-sm' placeholder='New email address' value={mail.email} onChange={(e) => setMail({ ...mail, email: e.target.value })} required />
					<input type='password' className='input input-bordered input-sm' placeholder='Your current password' value={mail.current} onChange={(e) => setMail({ ...mail, current: e.target.value })} required />
					<button className='btn btn-primary btn-sm rounded-full text-white w-fit' disabled={changingMail || !mail.email.trim() || !mail.current}>
						{changingMail ? "Saving..." : "Change email"}
					</button>
				</form>
			</Section>
		</>
	);
};

const AppearanceSection = () => {
	const [pref, setPref] = useState(getThemePreference);
	const choose = (value) => {
		setPref(value);
		setThemePreference(value);
	};
	return (
		<Section title='Appearance' hint='Remembered on this device.'>
			<div className='flex flex-wrap gap-2'>
				{[
					["dark", "Dark"],
					["light", "Light"],
					["system", "Match my device"],
				].map(([value, label]) => (
					<button
						key={value}
						type='button'
						onClick={() => choose(value)}
						className={`btn btn-sm rounded-full ${pref === value ? "btn-primary text-white" : "btn-outline"}`}
					>
						{label}
					</button>
				))}
			</div>
		</Section>
	);
};

const InstallSection = () => {
	const [, force] = useState(0);
	useEffect(() => subscribeInstall(() => force((n) => n + 1)), []);

	let body;
	if (isInstalled()) {
		body = <p className='text-sm text-slate-500'>Chrinnox is installed on this device. 🎉</p>;
	} else if (canPromptInstall()) {
		body = (
			<button className='btn btn-primary btn-sm rounded-full text-white w-fit' onClick={() => promptInstall()}>
				Install Chrinnox
			</button>
		);
	} else if (isIos()) {
		body = (
			<p className='text-sm'>
				On iPhone: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
			</p>
		);
	} else {
		body = (
			<p className='text-sm'>
				Open your browser menu (the three dots) and choose <b>Install app</b> or <b>Add to Home screen</b>.
			</p>
		);
	}
	return (
		<Section title='Install the app' hint='Opens full-screen from your home screen, like any other app.'>
			{body}
		</Section>
	);
};

const NOTIF_OPTIONS = [
	["message", "New messages"],
	["comment", "Replies to your posts"],
	["like", "Likes"],
	["repost", "Reposts"],
	["follow", "New followers"],
	["helpful", "Someone found your contribution helpful"],
	["accepted", "Your reply chosen as the best answer"],
];

const NotificationsSection = () => {
	const queryClient = useQueryClient();
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const [pushOn, setPushOn] = useState(false);
	const [busy, setBusy] = useState(false);
	const supported = pushSupported();

	useEffect(() => {
		let alive = true;
		currentSubscription()
			.then((s) => alive && setPushOn(!!s && Notification.permission === "granted"))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, []);

	const { mutate: setPref } = useMutation({
		mutationFn: (body) => postJson("/api/users/safety/notifications", body),
		onSuccess: (prefs) => queryClient.setQueryData(["authUser"], (old) => (old ? { ...old, notifPrefs: prefs } : old)),
		onError: (e) => toast.error(e.message),
	});

	const togglePush = async () => {
		setBusy(true);
		try {
			if (pushOn) {
				await disablePush();
				setPushOn(false);
				toast.success("Phone alerts are off on this device");
			} else {
				await enablePush();
				setPushOn(true);
				toast.success("Phone alerts are on");
			}
		} catch (e) {
			toast.error(e.message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Section title='Notifications' hint='Choose what you want to hear about, in the app and on your phone.'>
			<div className='flex flex-col gap-3'>
				{NOTIF_OPTIONS.map(([key, label]) => (
					<label key={key} className='flex items-center justify-between gap-3 cursor-pointer'>
						<span>{label}</span>
						<input
							type='checkbox'
							className='toggle toggle-primary'
							checked={authUser?.notifPrefs?.[key] !== false}
							onChange={(e) => setPref({ [key]: e.target.checked })}
						/>
					</label>
				))}
			</div>
			<div className='mt-4 pt-4 border-t border-line'>
				<p className='font-semibold'>Phone alerts on this device</p>
				{supported ? (
					<>
						<p className='text-sm text-slate-500 mb-2'>
							Get a ping even when Chrinnox is closed. On iPhone, install the app to your home screen first.
						</p>
						<button className='btn btn-primary btn-sm rounded-full text-white' onClick={togglePush} disabled={busy}>
							{busy ? "One moment..." : pushOn ? "Turn off phone alerts" : "Turn on phone alerts"}
						</button>
					</>
				) : (
					<p className='text-sm text-slate-500'>
						This browser can&apos;t show phone alerts. On iPhone, install Chrinnox to your home screen first.
					</p>
				)}
			</div>
		</Section>
	);
};

const SettingsPage = () => {
	const queryClient = useQueryClient();
	const { toggleMute, toggleBlock } = useSafetyActions();
	const [newWord, setNewWord] = useState("");

	const { data: safety, isLoading } = useQuery({
		queryKey: ["safety"],
		queryFn: async () => {
			const res = await fetch("/api/users/safety");
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
	});

	const { mutate: savePrivacy } = useMutation({
		mutationFn: (changes) => postJson("/api/users/safety/privacy", changes),
		onSuccess: () => {
			toast.success("Saved");
			queryClient.invalidateQueries({ queryKey: ["safety"] });
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: saveWords } = useMutation({
		mutationFn: (words) => postJson("/api/users/safety/muted-words", { words }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["safety"] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: logout } = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/auth/logout", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
		onError: () => toast.error("Logout failed"),
	});

	const addWord = (e) => {
		e.preventDefault();
		const word = newWord.trim().toLowerCase();
		if (!word) return;
		if (safety.mutedWords.includes(word)) return setNewWord("");
		saveWords([...safety.mutedWords, word]);
		setNewWord("");
	};

	if (isLoading) {
		return (
			<div className='flex-[4_4_0] border-l border-r border-line min-h-screen flex justify-center p-10'>
				<LoadingSpinner size='lg' />
			</div>
		);
	}

	return (
		<div className='flex-[4_4_0] border-l border-r border-line min-h-screen'>
			<div className='p-4 border-b border-line'>
				<p className='font-bold'>Settings</p>
				<p className='text-sm text-slate-500'>You decide who reaches you and what you see.</p>
			</div>

			<Section title='Privacy' hint='These rules are enforced by the server, so no one can get around them.'>
				<AudiencePicker
					label='Who can message me'
					value={safety.settings.whoCanMessage}
					onChange={(v) => savePrivacy({ whoCanMessage: v })}
				/>
				<AudiencePicker
					label='Who can reply to my posts'
					value={safety.settings.whoCanReply}
					onChange={(v) => savePrivacy({ whoCanReply: v })}
				/>
			</Section>

			<Section
				title='Muted words'
				hint='Posts containing these words are hidden from your feeds. They still show if you open a profile.'
			>
				<form onSubmit={addWord} className='flex gap-2 mb-3'>
					<input
						type='text'
						className='input input-bordered input-sm rounded-full flex-1'
						placeholder='Add a word or phrase'
						maxLength={40}
						value={newWord}
						onChange={(e) => setNewWord(e.target.value)}
					/>
					<button className='btn btn-primary btn-sm rounded-full text-white'>Add</button>
				</form>
				<div className='flex flex-wrap gap-2'>
					{safety.mutedWords.length === 0 && <p className='text-sm text-slate-500'>No muted words.</p>}
					{safety.mutedWords.map((w) => (
						<span key={w} className='badge badge-lg gap-1'>
							{w}
							<IoCloseSharp
								className='cursor-pointer'
								onClick={() => saveWords(safety.mutedWords.filter((x) => x !== w))}
							/>
						</span>
					))}
				</div>
			</Section>

			<Section title='Muted accounts' hint="You won't see their posts in your feeds. They aren't told.">
				<PeopleList
					people={safety.mutedUsers}
					actionLabel='Unmute'
					onAction={toggleMute}
					emptyText="You haven't muted anyone."
				/>
			</Section>

			<Section title='Blocked accounts' hint='They cannot follow, message or reply to you, and you will not see each other in feeds.'>
				<PeopleList
					people={safety.blockedUsers}
					actionLabel='Unblock'
					onAction={toggleBlock}
					emptyText="You haven't blocked anyone."
				/>
			</Section>

			<NotificationsSection />

			<InstallSection />

			<AppearanceSection />

			<SecurityForms />

			<Section title='Account'>
				<div className='flex flex-wrap gap-2'>
					<Link to='/bookmarks' className='btn btn-outline btn-sm rounded-full'>
						Saved posts
					</Link>
					<button className='btn btn-outline btn-sm rounded-full' onClick={() => logout()}>
						Log out
					</button>
				</div>
			</Section>
		</div>
	);
};
export default SettingsPage;
