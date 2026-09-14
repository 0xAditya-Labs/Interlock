const NoChatSelected = () => {
  return (
    <div className="w-full flex flex-1 flex-col items-center justify-center p-16 bg-base-100/50">
      <div className="max-w-md text-center space-y-6">
        {/* Icon Display */}
        <div className="flex justify-center gap-4 mb-4">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-[spin_10s_linear_infinite]" />
            
            {/* Core Hub */}
            <div className="relative z-10 w-12 h-12 bg-base-200 rounded-xl shadow-sm border border-base-300 flex items-center justify-center rotate-45 group">
               <div className="w-6 h-6 bg-primary/20 rounded-lg -rotate-45 flex items-center justify-center animate-pulse">
                  <div className="w-2 h-2 bg-primary rounded-full" />
               </div>
            </div>
          </div>
        </div>

        {/* Welcome Text */}
        <h2 className="text-2xl font-bold tracking-tight">Welcome to Interlock</h2>
        <p className="text-base-content/60">
          Select a conversation from the sidebar to start chatting
        </p>
      </div>
    </div>
  );
};

export default NoChatSelected;
