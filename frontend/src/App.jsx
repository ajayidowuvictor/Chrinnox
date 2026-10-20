import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import HomePage from "./pages/home/HomePage";
import LoginPage from "./pages/auth/login/LoginPage";
import SignUpPage from "./pages/auth/signup/SignUpPage";
import NotificationPage from "./pages/notification/NotificationPage";
import ProfilePage from "./pages/profile/ProfilePage";
import BookmarksPage from "./pages/bookmarks/BookmarksPage";
import MessagesPage from "./pages/messages/MessagesPage";
import PostPage from "./pages/post/PostPage";
import SearchPage from "./pages/search/SearchPage";
import SettingsPage from "./pages/settings/SettingsPage";
import TopicPage from "./pages/topic/TopicPage";
import CommunityPage from "./pages/community/CommunityPage";
import CreateCommunityPage from "./pages/community/CreateCommunityPage";

import Sidebar from "./components/common/Sidebar";
import RightPanel from "./components/common/RightPanel";

import { Toaster } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "./components/common/LoadingSpinner";

function App() {
	const { pathname } = useLocation();
	const { data: authUser, isLoading } = useQuery({
		// we use queryKey to give a unique name to our query and refer to it later
		queryKey: ["authUser"],
		queryFn: async () => {
			try {
				const res = await fetch("/api/auth/me");
				const data = await res.json();
				if (data.error) return null;
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				console.log("authUser is here:", data);
				return data;
			} catch (error) {
				throw new Error(error);
			}
		},
		retry: false,
	});

	if (isLoading) {
		return (
			<div className='h-screen flex justify-center items-center'>
				<LoadingSpinner size='lg' />
			</div>
		);
	}

	return (
		<div className={`flex max-w-6xl mx-auto ${pathname.startsWith("/messages/") ? "" : "pb-16 md:pb-0"}`}>
			{/* Common component, bc it's not wrapped with Routes */}
			{authUser && <Sidebar />}
			<Routes>
				<Route path='/' element={authUser ? <HomePage /> : <Navigate to='/login' />} />
				<Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to='/' />} />
				<Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to='/' />} />
				<Route path='/notifications' element={authUser ? <NotificationPage /> : <Navigate to='/login' />} />
				<Route path='/post/:id' element={authUser ? <PostPage /> : <Navigate to='/login' />} />
				<Route path='/topic/:name' element={authUser ? <TopicPage /> : <Navigate to='/login' />} />
				<Route path='/c/:slug' element={authUser ? <CommunityPage /> : <Navigate to='/login' />} />
				<Route path='/communities/new' element={authUser ? <CreateCommunityPage /> : <Navigate to='/login' />} />
				<Route path='/settings' element={authUser ? <SettingsPage /> : <Navigate to='/login' />} />
				<Route path='/search' element={authUser ? <SearchPage /> : <Navigate to='/login' />} />
				<Route path='/bookmarks' element={authUser ? <BookmarksPage /> : <Navigate to='/login' />} />
				<Route path='/messages' element={authUser ? <MessagesPage /> : <Navigate to='/login' />} />
				<Route path='/messages/:username' element={authUser ? <MessagesPage /> : <Navigate to='/login' />} />
				<Route path='/profile/:username' element={authUser ? <ProfilePage /> : <Navigate to='/login' />} />
			</Routes>
			{authUser && <RightPanel />}
			<Toaster />
		</div>
	);
}

export default App;
