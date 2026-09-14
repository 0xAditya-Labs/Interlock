const AuthImagePattern = ({ title, subtitle }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-base-200/50 p-12">
      <div className="max-w-md text-center">
        <div className="relative w-full max-w-sm mx-auto mb-10 h-64">
          <div className="absolute inset-0 border border-base-300 bg-base-100 rounded-[2rem] shadow-2xl overflow-hidden p-6 flex flex-col gap-5 justify-end">
             {/* Header */}
             <div className="absolute top-6 left-6 right-6 flex items-center gap-3 border-b border-base-200 pb-4">
               <div className="w-8 h-8 rounded-full bg-base-300 animate-pulse"></div>
               <div className="flex flex-col gap-2">
                 <div className="w-20 h-2 rounded-full bg-base-300"></div>
                 <div className="w-12 h-1.5 rounded-full bg-base-200"></div>
               </div>
             </div>
             
             {/* Chat Bubbles */}
             <div className="w-3/4 h-12 rounded-2xl rounded-tl-sm bg-base-200 self-start mt-12 opacity-80"></div>
             <div className="w-2/3 h-12 rounded-2xl rounded-tr-sm bg-primary/20 text-primary self-end opacity-90"></div>
             <div className="w-4/5 h-16 rounded-2xl rounded-tl-sm bg-base-200 self-start opacity-80"></div>
             
             {/* Input Area */}
             <div className="w-full h-10 mt-2 rounded-full bg-base-200/50 flex items-center px-4">
                <div className="w-1/3 h-2 rounded-full bg-base-300/50"></div>
             </div>
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-4 tracking-tight">{title}</h2>
        <p className="text-base-content/60 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};

export default AuthImagePattern;
