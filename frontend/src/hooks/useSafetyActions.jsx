import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const post = async (url) => {
	const res = await fetch(url, { method: "POST" });
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || "Something went wrong");
	return data;
};

// mute / block actions shared by posts, profiles and the settings page
const useSafetyActions = () => {
	const queryClient = useQueryClient();

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["authUser"] });
		queryClient.invalidateQueries({ queryKey: ["safety"] });
		queryClient.invalidateQueries({ queryKey: ["posts"] });
		queryClient.invalidateQueries({ queryKey: ["suggestedUsers"] });
	};

	const { mutate: toggleMute } = useMutation({
		mutationFn: (userId) => post(`/api/users/mute/${userId}`),
		onSuccess: (data) => {
			toast.success(data.muted ? "Muted. Their posts are hidden from your feeds" : "Unmuted");
			refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const { mutate: toggleBlock } = useMutation({
		mutationFn: (userId) => post(`/api/users/block/${userId}`),
		onSuccess: (data) => {
			toast.success(data.blocked ? "Blocked" : "Unblocked");
			refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	return { toggleMute, toggleBlock };
};

export default useSafetyActions;
