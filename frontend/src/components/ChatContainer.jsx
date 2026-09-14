import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <ChatHeader className="flex-shrink-0" />
        <MessageSkeleton />
        <MessageInput className="flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-shrink-0 z-10">
        <ChatHeader />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-base-100/30">
        {messages.map((message) => (
          <div
            key={message._id}
            className={`flex ${message.senderId === authUser._id ? "justify-end" : "justify-start"}`}
            ref={messageEndRef}
          >
            <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${message.senderId === authUser._id ? "flex-row-reverse" : "flex-row"}`}>
              <div className="flex-shrink-0">
                <div className="size-8 rounded-full overflow-hidden shadow-sm border border-base-200">
                  <img
                    src={
                      message.senderId === authUser._id
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className={`flex flex-col gap-1 ${message.senderId === authUser._id ? "items-end" : "items-start"}`}>
                <div className="text-[10px] text-base-content/50 font-medium px-1">
                  {formatMessageTime(message.createdAt)}
                </div>
                <div className={`
                  flex flex-col overflow-hidden px-4 py-2.5 rounded-2xl shadow-sm
                  ${message.senderId === authUser._id 
                    ? "bg-primary text-primary-content rounded-br-sm" 
                    : "bg-base-200 text-base-content rounded-bl-sm"}
                `}>
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Attachment"
                      className="sm:max-w-[250px] rounded-xl mb-2 object-cover border border-base-100/10"
                    />
                  )}
                  {message.text && <p className="text-[15px] leading-relaxed">{message.text}</p>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 z-10">
        <MessageInput />
      </div>
    </div>
  );
};
export default ChatContainer;
