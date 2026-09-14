import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import AuthImagePattern from "../components/AuthImagePattern";
import { Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MessageSquare } from "lucide-react";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const { login, isLoggingIn } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-hidden bg-base-100">
        
        {/* Snow/Glass Effect Background Elements */}
        <div className="absolute top-1/4 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none opacity-80 mix-blend-screen" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none opacity-90 mix-blend-screen" />
        <div className="absolute top-10 right-10 w-32 h-32 bg-base-content/10 rounded-full blur-2xl pointer-events-none opacity-60" />
        
        {/* Small floating snow particles */}
        <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-white/80 rounded-full blur-[1px] shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
        <div className="absolute bottom-1/4 right-1/3 w-3 h-3 bg-white/60 rounded-full blur-[1px] shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-primary/40 rounded-full blur-[1px]" />

        <div className="w-full max-w-md z-10 relative bg-base-100/40 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] border border-base-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors p-2">
                <img src="/interlck - vectorink-background-removed.png" alt="logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Welcome Back</h1>
              <p className="text-base-content/60">Sign in to your account</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-medium text-sm">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-base-content/40" />
                </div>
                <input
                  type="email"
                  className="input input-bordered w-full pl-10 bg-base-100 focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-xl"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-medium text-sm">Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-base-content/40" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="input input-bordered w-full pl-10 bg-base-100 focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-xl"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/40 hover:text-base-content transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button type="submit" className="btn btn-primary w-full" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
              <button 
                type="button" 
                className="btn btn-sm btn-secondary w-full gap-2" 
                onClick={() => setFormData({ email: "interlock_guest_01@gamil.com", password: "12345678" })}
              >
                <KeyRound className="size-4" />
                Fill Guest Credentials
              </button>
            </div>
          </form>

          <div className="text-center mt-4">
            <p className="text-base-content/60 text-sm">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="link link-primary font-medium hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Image/Pattern */}
      <AuthImagePattern
        title={"Welcome back!"}
        subtitle={"Sign in to continue your conversations and catch up with your messages."}
      />
    </div>
  );
};
export default LoginPage;
