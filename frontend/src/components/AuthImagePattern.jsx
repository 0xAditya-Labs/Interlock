const AuthImagePattern = ({ title, subtitle }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-base-200/50 p-12">
      <div className="max-w-md text-center">
        {/* Interlock Branding Abstract Visual */}
        <div className="relative w-64 h-64 mx-auto mb-10 flex items-center justify-center">
          {/* Outer Synchronization Ring */}
          <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-[spin_15s_linear_infinite]" />
          <div className="absolute inset-4 border border-base-300 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
          
          {/* Inner Interlocking Nodes */}
          <div className="absolute w-40 h-40 border border-primary/10 rounded-full animate-[spin_10s_linear_infinite] flex items-center justify-center">
             {/* Nodes */}
             <div className="absolute -top-1.5 w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_currentColor]" />
             <div className="absolute -bottom-1.5 w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_currentColor]" />
             <div className="absolute -left-1.5 w-3 h-3 bg-primary/50 rounded-full" />
             <div className="absolute -right-1.5 w-3 h-3 bg-primary/50 rounded-full" />
          </div>

          {/* Core Hub */}
          <div className="relative z-10 w-24 h-24 bg-base-100 rounded-3xl shadow-2xl border border-base-200 flex items-center justify-center rotate-45">
             <div className="w-10 h-10 bg-primary/10 rounded-xl -rotate-45 flex items-center justify-center">
                <div className="w-4 h-4 bg-primary rounded-full shadow-sm" />
             </div>
          </div>
          
          {/* Connecting Lines */}
          <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent rotate-45" />
          <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent -rotate-45" />
        </div>

        <h2 className="text-3xl font-bold mb-4 tracking-tight">{title}</h2>
        <p className="text-base-content/60 leading-relaxed text-lg">{subtitle}</p>
      </div>
    </div>
  );
};

export default AuthImagePattern;
