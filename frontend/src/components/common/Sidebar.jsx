import Logo from "../svgs/Logo";

import { MdHomeFilled } from "react-icons/md";
import { IoNotifications, IoMail, IoSearch, IoSettingsSharp, IoPeople, IoBriefcase } from "react-icons/io5";
import { FaUser, FaBookmark } from "react-icons/fa";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BiLogOut } from "react-icons/bi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const Sidebar = () => {
	const queryClient = useQueryClient();
	const { mutate: logout } = useMutation({
		mutationFn: async () => {
			try {
				const res = await fetch("/api/auth/logout", {
					method: "POST",
				});
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
			} catch (error) {
				throw new Error(error);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
		},
		onError: () => {
			toast.error("Logout failed");
		},
	});
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const { data: unreadNotifications } = useQuery({
		queryKey: ["notificationCount"],
		queryFn: async () => {
			const res = await fetch("/api/notifications/unread-count");
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data.count;
		},
		refetchInterval: 15000,
		enabled: !!authUser,
	});
	const { data: unread } = useQuery({
		queryKey: ["unreadCount"],
		queryFn: async () => {
			const res = await fetch("/api/messages/unread-count");
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data.count;
		},
		refetchInterval: 15000,
		enabled: !!authUser,
	});

	const { pathname } = useLocation();
	const inChat = pathname.startsWith("/messages/"); // the chat needs the whole screen on phones

	const Badge = ({ count }) =>
		count > 0 ? (
			<span className='absolute -top-2 -right-2 bg-sky-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center'>
				{count > 99 ? "99+" : count}
			</span>
		) : null;

	const tabClass = ({ isActive }) =>
		`relative flex flex-col items-center justify-center flex-1 py-1 ${isActive ? "text-white" : "text-slate-500"}`;

	return (
		<>
		<div className='hidden md:block md:flex-[2_2_0] max-w-52'>
			<div className='sticky top-0 left-0 h-screen flex flex-col border-r border-gray-700 w-full'>
				<Link to='/' className='flex justify-center md:justify-start'>
					<Logo className='px-2 w-12 h-12 rounded-full text-white hover:bg-stone-900' />
				</Link>
				<ul className='flex flex-col gap-3 mt-4'>
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<MdHomeFilled className='w-8 h-8' />
							<span className='text-lg hidden md:block'>Home</span>
						</Link>
					</li>
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/search'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<IoSearch className='w-6 h-6' />
							<span className='text-lg hidden md:block'>Explore</span>
						</Link>
					</li>
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/search?tab=opportunities'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<IoBriefcase className='w-6 h-6' />
							<span className='text-lg hidden md:block'>Opportunities</span>
						</Link>
					</li>
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/search?tab=communities'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<IoPeople className='w-6 h-6' />
							<span className='text-lg hidden md:block'>Communities</span>
						</Link>
					</li>
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/notifications'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<span className='relative'>
								<IoNotifications className='w-6 h-6' />
								{unreadNotifications > 0 && (
									<span className='absolute -top-2 -right-2 bg-sky-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center'>
										{unreadNotifications > 99 ? "99+" : unreadNotifications}
									</span>
								)}
							</span>
							<span className='text-lg hidden md:block'>Notifications</span>
						</Link>
					</li>

					<li className='flex justify-center md:justify-start'>
						<Link
							to='/messages'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<span className='relative'>
								<IoMail className='w-6 h-6' />
								{unread > 0 && (
									<span className='absolute -top-2 -right-2 bg-sky-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center'>
										{unread > 99 ? "99+" : unread}
									</span>
								)}
							</span>
							<span className='text-lg hidden md:block'>Messages</span>
						</Link>
					</li>

					<li className='flex justify-center md:justify-start'>
						<Link
							to='/bookmarks'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<FaBookmark className='w-5 h-5' />
							<span className='text-lg hidden md:block'>Saved</span>
						</Link>
					</li>

					<li className='flex justify-center md:justify-start'>
						<Link
							to='/settings'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<IoSettingsSharp className='w-6 h-6' />
							<span className='text-lg hidden md:block'>Settings</span>
						</Link>
					</li>

					<li className='flex justify-center md:justify-start'>
						<Link
							to={`/profile/${authUser?.username}`}
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<FaUser className='w-6 h-6' />
							<span className='text-lg hidden md:block'>Profile</span>
						</Link>
					</li>
				</ul>
				{authUser && (
					<Link
						to={`/profile/${authUser.username}`}
						className='mt-auto mb-10 flex gap-2 items-start transition-all duration-300 hover:bg-[#181818] py-2 px-4 rounded-full'
					>
						<div className='avatar hidden md:inline-flex'>
							<div className='w-8 rounded-full'>
								<img src={authUser?.profileImg || "/avatar-placeholder.png"} />
							</div>
						</div>
						<div className='flex justify-between flex-1'>
							<div className='hidden md:block'>
								<p className='text-white font-bold text-sm w-20 truncate'>{authUser?.fullName}</p>
								<p className='text-slate-500 text-sm'>@{authUser?.username}</p>
							</div>
							<BiLogOut
								className='w-5 h-5 cursor-pointer'
								onClick={(e) => {
									e.preventDefault();
									logout();
								}}
							/>
						</div>
					</Link>
				)}
			</div>
		</div>

		{/* phone navigation bar */}
		{!inChat && (
			<nav
				className='md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-gray-700 bg-base-100 pb-[env(safe-area-inset-bottom)]'
				aria-label='Main navigation'
			>
				<NavLink to='/' end className={tabClass} aria-label='Home'>
					<MdHomeFilled className='w-7 h-7' />
				</NavLink>
				<NavLink to='/search' className={tabClass} aria-label='Explore'>
					<IoSearch className='w-6 h-6' />
				</NavLink>
				<NavLink to='/messages' className={tabClass} aria-label='Messages'>
					<span className='relative'>
						<IoMail className='w-6 h-6' />
						<Badge count={unread} />
					</span>
				</NavLink>
				<NavLink to='/notifications' className={tabClass} aria-label='Notifications'>
					<span className='relative'>
						<IoNotifications className='w-6 h-6' />
						<Badge count={unreadNotifications} />
					</span>
				</NavLink>
				<NavLink to={`/profile/${authUser?.username}`} className={tabClass} aria-label='Profile'>
					<FaUser className='w-5 h-5' />
				</NavLink>
			</nav>
		)}
		</>
	);
};
export default Sidebar;
