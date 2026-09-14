import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MessageSquare, User } from "lucide-react";
import { Link } from "react-router-dom";

import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const { signup, isSigningUp } = useAuthStore();

  const validateForm = () => {
    if (!formData.fullName.trim()) return toast.error("Full name is required");
    if (!formData.email.trim()) return toast.error("Email is required");
    if (!/\S+@\S+\.\S+/.test(formData.email)) return toast.error("Invalid email format");
    if (!formData.password) return toast.error("Password is required");
    if (formData.password.length < 6) return toast.error("Password must be at least 6 characters");

    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const success = validateForm();

    if (success === true) signup(formData);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* left side */}
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
          {/* LOGO */}
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors p-2">
                <img src="/interlck - vectorink-background-removed.png" alt="logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Create Account</h1>
              <p className="text-base-content/60">Get started with your free account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-medium text-sm">Full Name</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="size-5 text-base-content/40" />
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full pl-10 bg-base-100 focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-xl"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-medium text-sm">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="size-5 text-base-content/40" />
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
                  <Lock className="size-5 text-base-content/40" />
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
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button type="submit" className="btn btn-primary w-full" disabled={isSigningUp}>
                {isSigningUp ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary w-full gap-2"
                onClick={() => setFormData({ fullName: "guest_01", email: "interlock_guest_01@gamil.com", password: "12345678" })}
              >
                <KeyRound className="size-4" />
                Fill Guest Credentials
              </button>
            </div>
          </form>

          <div className="text-center mt-6">
            <p className="text-base-content/60 text-sm">
              Already have an account?{" "}
              <Link to="/login" className="link link-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      {/* right side */}

      <AuthImagePattern
        title="Join our community"
        subtitle="Connect with friends, share moments, and stay in touch with your loved ones."
      />
    </div>
  );
};
export default SignUpPage;
