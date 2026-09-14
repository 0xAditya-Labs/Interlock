import { X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();

  return (
    <div className="p-4 border-b border-base-200 bg-base-100/50 backdrop-blur-sm z-10 sticky top-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="size-10 rounded-full overflow-hidden border border-base-200 shadow-sm">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} className="object-cover w-full h-full" />
            </div>
            {onlineUsers.includes(selectedUser._id) && (
              <span className="absolute bottom-0 right-0 size-2.5 bg-green-500 rounded-full ring-2 ring-base-100" />
            )}
          </div>

          {/* User info */}
          <div>
            <h3 className="font-semibold text-sm tracking-tight">{selectedUser.fullName}</h3>
            <p className="text-xs text-base-content/60 mt-0.5">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => setSelectedUser(null)}
          className="p-2 rounded-full hover:bg-base-200 text-base-content/70 hover:text-base-content transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
};
export default ChatHeader;
