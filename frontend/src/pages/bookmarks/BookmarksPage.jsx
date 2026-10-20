import Posts from "../../components/common/Posts";

const BookmarksPage = () => {
	return (
		<div className='flex-[4_4_0] border-l border-r border-gray-700 min-h-screen'>
			<div className='p-4 border-b border-gray-700'>
				<p className='font-bold'>Saved</p>
				<p className='text-sm text-slate-500'>Posts you have bookmarked</p>
			</div>
			<Posts feedType='bookmarks' />
		</div>
	);
};
export default BookmarksPage;
