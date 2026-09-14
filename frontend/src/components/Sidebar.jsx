import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading
  } = useChatStore();

  const { onlineUsers = [] } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  // 🛡️ Make sure users is always an array
  const safeUsers = Array.isArray(users) ? users : [];

  const filteredUsers = showOnlineOnly
    ? safeUsers.filter((user) => onlineUsers.includes(user._id))
    : safeUsers;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200 bg-base-100/50">
      <div className="border-b border-base-200 w-full p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Users className="size-5" />
          </div>
          <span className="font-semibold tracking-tight hidden lg:block">Contacts</span>
        </div>

        <div className="mt-4 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content transition-colors">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-xs rounded"
            />
            <span>Online only</span>
          </label>
          <span className="text-xs px-2 py-0.5 bg-base-200 rounded-full text-base-content/60 font-medium">
            {onlineUsers.length - 1}
          </span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3 px-2 space-y-1">
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-3 flex items-center gap-3 rounded-xl transition-all duration-200
              ${selectedUser?._id === user._id 
                ? "bg-primary/10 text-primary shadow-sm" 
                : "hover:bg-base-200/50 text-base-content"}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-10 object-cover rounded-full shadow-sm"
              />
              {onlineUsers.includes(user._id) && (
                <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100" />
              )}
            </div>

            <div className="hidden lg:block text-left min-w-0 flex-1">
              <div className="font-medium truncate text-sm">{user.fullName}</div>
              <div className={`text-xs mt-0.5 truncate ${
                selectedUser?._id === user._id ? "text-primary/70" : "text-base-content/50"
              }`}>
                {onlineUsers.includes(user._id) ? "Online" : "Offline"}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-base-content/50 py-8 text-sm">
            No users found
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

