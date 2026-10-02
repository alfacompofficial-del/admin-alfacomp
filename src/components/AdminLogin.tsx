import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff, AlertOctagon } from "lucide-react";
import { toast } from "sonner";

interface AdminLoginProps {
  onSuccess: () => void;
}

const MAX_ATTEMPTS = 20;
const LOCKOUT_MS = 30 * 60 * 1000;
const VALID_EMAIL = "alfacompofficial@gmail.com";
const VALID_PASS = "Bilol2013/*-++-*/";

// Constant-time compare to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  const aLen = a.length, bLen = b.length;
  let result = aLen ^ bLen;
  const max = Math.max(aLen, bLen);
  for (let i = 0; i < max; i++) {
    result |= (i < aLen ? a.charCodeAt(i) : 0) ^ (i < bLen ? b.charCodeAt(i) : 0);
  }
  return result === 0;
}

// Detect SQL injection patterns
function isSqlInjection(s: string): boolean {
  const patterns = [
    /(\bOR\b|\bAND\b)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i,
    /(\bOR\b|\bAND\b)\s+TRUE\b/i,
    /--[^\r\n]*/,
    /\/\*[\s\S]*?\*\//,
    /\b(UNION(\s+ALL)?\s+SELECT)\b/i,
    /\b(DROP\s+TABLE|ALTER\s+TABLE|EXEC(\s+XP_)?)\b/i,
    /'"\s*;\s*--/i,
    /'"\s*OR\s*'"\w+'"='"?\w+/i,
  ];
  return patterns.some(rx => rx.test(s));
}

// Sanitize XSS in feedback messages
function sanitize(s: string): string {
  return s.replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] ?? m)
  );
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("_afc_att") ?? "0", 10) || 0; }
    catch { return 0; }
  });
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    try {
      const v = parseInt(localStorage.getItem("_afc_lock") ?? "0", 10);
      return v && v > Date.now() ? v : null;
    } catch { return null; }
  });
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const left = lockedUntil - Date.now();
      if (left <= 0) {
        setLockedUntil(null);
        localStorage.removeItem("_afc_lock");
        localStorage.removeItem("_afc_att");
        setAttempts(0);
        clearInterval(id);
      } else setTimeLeft(Math.ceil(left / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (lockedUntil) return;
    if (attempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      setLockedUntil(until);
      localStorage.setItem("_afc_lock", String(until));
      setError("Превышен лимит попыток. Доступ заблокирован на 30 минут.");
      return;
    }

    const emailClean = email.trim();
    const passClean = password;

    // Security checks
    if (isSqlInjection(emailClean) || isSqlInjection(passClean)) {
      setError(sanitize("Обнаружен запрещённый паттерн ввода. Доступ отказан."));
      const newAtt = attempts + 1;
      setAttempts(newAtt);
      localStorage.setItem("_afc_att", String(newAtt));
      return;
    }

    setLoading(true);
    // Simulate network delay for timing consistency
    await new Promise(r => setTimeout(r, 350 + Math.random() * 150));

    const ok = safeCompare(emailClean, VALID_EMAIL) && safeCompare(passClean, VALID_PASS);

    if (ok) {
      sessionStorage.setItem("_afc_auth", "1");
      localStorage.removeItem("_afc_att");
      localStorage.removeItem("_afc_lock");
      toast.success("Доступ разрешён. Добро пожаловать.");
      onSuccess();
    } else {
      const newAtt = attempts + 1;
      setAttempts(newAtt);
      localStorage.setItem("_afc_att", String(newAtt));
      if (newAtt >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        localStorage.setItem("_afc_lock", String(until));
        setError("Превышен лимит попыток (20). Заблокировано на 30 минут.");
      } else {
        setError(`Неверные данные. Осталось попыток: ${MAX_ATTEMPTS - newAtt}`);
      }
    }
    setLoading(false);
  };

  const isLocked = !!lockedUntil;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,90,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,90,0,0.03) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF5A00]/[0.04] via-transparent to-[#3B82F6]/[0.04] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF5A00] to-[#FF8A00] mb-4 shadow-xl shadow-[#FF5A00]/30">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            ALFACOMP <span className="text-[#FF5A00]">ADMIN</span>
          </h1>
          <p className="text-xs text-white/40 font-mono mt-1 uppercase tracking-widest">Control Center v2.0</p>
        </div>

        <div className="bg-[#0d0f18]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
          {isLocked ? (
            <div className="text-center space-y-4 py-4">
              <AlertOctagon className="w-10 h-10 text-red-400 mx-auto" />
              <div>
                <p className="text-red-400 font-bold text-sm">Доступ заблокирован</p>
                <p className="text-white/50 text-xs mt-1.5">Разблокировка через</p>
                <p className="text-white font-mono text-3xl font-bold mt-2 tabular-nums">
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    className="w-full bg-[#141720] border border-white/10 focus:border-[#FF5A00] rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    className="w-full bg-[#141720] border border-white/10 focus:border-[#FF5A00] rounded-xl pl-10 pr-11 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5"
                  >
                    <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400 font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#FF5A00] to-[#FF7A20] hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF5A00]/20"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Войти в панель <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <div className="flex items-center justify-between text-[10px] font-mono text-white/25 pt-1">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#FF5A00]" /> SQLi/XSS protected</span>
                <span>Попыток: {attempts}/{MAX_ATTEMPTS}</span>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-white/20 font-mono mt-6 uppercase tracking-widest">
          admin.alfacompp.uz — Restricted Access
        </p>
      </motion.div>
    </div>
  );
}
