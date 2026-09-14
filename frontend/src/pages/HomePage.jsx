import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen bg-base-200/30 flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center pt-20 px-4 pb-8 overflow-hidden min-h-0">
        <div className="bg-base-100 rounded-[2rem] shadow-2xl w-full max-w-6xl h-full border border-base-300/50 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 flex h-full overflow-hidden min-h-0">
            <Sidebar />
            {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
