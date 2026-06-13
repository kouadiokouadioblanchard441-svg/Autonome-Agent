import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, Mail, ShieldAlert, Loader2 } from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.svg";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Remplis tous les champs."); return; }
    setLoading(true);
    setError("");
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      setAttempts((a) => a + 1);
      setError(result.error ?? "Accès refusé");
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#00E5FF 1px, transparent 1px), linear-gradient(90deg, #00E5FF 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="bg-[#0a1628]/90 border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 backdrop-blur-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400" />

          <div className="p-8 space-y-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <img src={nexusLogo} alt="Nexus AI" className="w-24 h-24 drop-shadow-[0_0_20px_rgba(0,229,255,0.4)]" />
                <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-pulse" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-black tracking-widest text-white uppercase">
                  NEXUS<span className="text-cyan-400"> AI</span>
                </h1>
                <p className="text-xs text-cyan-400/60 font-mono tracking-[0.3em] uppercase mt-1">
                  Panneau de Contrôle
                </p>
              </div>
            </div>

            {/* Badge */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
              <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs text-cyan-300/70 font-mono">
                Accès restreint — Opérateur &amp; clients autorisés
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="votre@email.com"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••••••"
                    className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm text-red-400">{error}</span>
                  {attempts >= 3 && <span className="text-xs text-red-300/60 ml-auto">{attempts} tentatives</span>}
                </div>
              )}

              <Button type="submit" disabled={loading || !email || !password} className="w-full h-11 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold tracking-wide shadow-lg shadow-cyan-500/20 disabled:opacity-40 transition-all">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vérification...</> : <><Lock className="w-4 h-4 mr-2" />Accéder au panneau</>}
              </Button>
            </form>
          </div>

          <div className="px-8 py-4 bg-black/20 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-zinc-600 font-mono">v2.0.0 · Nexus AI</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-zinc-500 font-mono">Système en ligne</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
