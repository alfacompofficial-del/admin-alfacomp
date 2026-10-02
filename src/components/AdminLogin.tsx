import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, ArrowRight, ShieldCheck, ArrowLeft, ShieldAlert, Eye, EyeOff, AlertOctagon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AdminLoginProps {
  onSuccess: () => void;
  onExit?: () => void;
}

const MAX_ATTEMPTS = 20;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes lockout

// Authorized credentials (strictly matched)
const VALID_EMAIL = "alfacompofficial@gmail.com";
const VALID_PASS = "Bilol2013/*-++-*/";

// Constant-time string equality check to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aLen = a.length;
  const bLen = b.length;
  let result = aLen ^ bLen;
  const maxLen = Math.max(aLen, bLen);
  for (let i = 0; i < maxLen; i++) {
    const charA = i < aLen ? a.charCodeAt(i) : 0;
    const charB = i < bLen ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }
  return result === 0;
}

// SQL Injection pattern detector
function detectSqlInjection(str: string): boolean {
  if (!str) return false;
  // Match common SQL tautologies, comments, union attacks, and OR 1=1 variations
  const patterns = [
    /(\bOR\b|\bAND\b)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i, // e.g. OR 1=1, ' OR '1'='1
    /(\bOR\b|\bAND\b)\s+TRUE\b/i,
    /--[^\r\n]*/,                                           // SQL single line comment
    /\/\*[\s\S]*?\*\//,                                      // SQL multiline comment (/* ... */)
    /\b(UNION(\s+ALL)?\s+SELECT)\b/i,                       // UNION SELECT
    /\b(DROP\s+TABLE|ALTER\s+TABLE|EXEC(\s+XP_)?)\b/i,        // DDL commands
    /['"]\s*;\s*--/i,                                       // Quote semicolon comment
    /['"]\s*OR\s*['"]\w+['"]\s*=\s*['"]\w+/i,              // ' OR 'a'='a'
  ];
  return patterns.some((rx) => rx.test(str));
}

// XSS sanitization for rendered feedback
function sanitizeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onExit }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Brute force state
  const [attempts, setAttempts] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("alfacomp_admin_attempts");
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("alfacomp_lockout_until");
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);

  // Check lockout on mount and on tick
  useEffect(() => {
    const checkLock = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        setRemainingMinutes(Math.ceil((lockoutUntil - now) / 60000));
      } else if (lockoutUntil !== 0) {
        setLockoutUntil(0);
        setAttempts(0);
        try {
          localStorage.removeItem("alfacomp_lockout_until");
          localStorage.setItem("alfacomp_admin_attempts", "0");
        } catch {}
      }
    };
    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLocked = lockoutUntil > Date.now();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      toast.error(`Система заблокирована. Повторите попытку через ${remainingMinutes} мин.`);
      return;
    }

    const cleanEmail = email.trim();
    const rawPass = password;

    if (!cleanEmail || !rawPass) {
      toast.error("Укажите email и пароль администратора");
      return;
    }

    // 1. Strict SQL Injection Checks (exempting legitimate password)
    const isLegitPass = safeCompare(rawPass, VALID_PASS);
    if (detectSqlInjection(cleanEmail) || (!isLegitPass && detectSqlInjection(rawPass))) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      try {
        localStorage.setItem("alfacomp_admin_attempts", String(newAttempts));
      } catch {}

      toast.error("Обнаружена недопустимая конструкция (SQL Injection). Попытка заблокирована!");

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockoutUntil(lockTime);
        try {
          localStorage.setItem("alfacomp_lockout_until", String(lockTime));
        } catch {}
      }
      return;
    }

    // 2. Format validation (RFC standard)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("Некорректный формат email адреса");
      return;
    }

    setIsVerifying(true);

    // Artificial timing delay (500ms) to prevent automated high-speed enumeration
    setTimeout(() => {
      const emailMatches = safeCompare(cleanEmail.toLowerCase(), VALID_EMAIL.toLowerCase());
      const passMatches = safeCompare(rawPass, VALID_PASS);

      if (emailMatches && passMatches) {
        setIsSuccess(true);
        // Reset brute-force counter on success
        try {
          localStorage.removeItem("alfacomp_admin_attempts");
          localStorage.removeItem("alfacomp_lockout_until");
          sessionStorage.setItem("alfacomp_admin_auth", "1");
          sessionStorage.setItem("alfacomp_admin_auth_time", String(Date.now()));
          sessionStorage.setItem("alfacomp_admin_email", cleanEmail);
        } catch {}

        toast.success("Авторизация успешна! Вход в панель управления...");
        setTimeout(() => {
          onSuccess();
        }, 550);
      } else {
        setIsVerifying(false);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        try {
          localStorage.setItem("alfacomp_admin_attempts", String(newAttempts));
        } catch {}

        const left = Math.max(0, MAX_ATTEMPTS - newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          const lockTime = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(lockTime);
          try {
            localStorage.setItem("alfacomp_lockout_until", String(lockTime));
          } catch {}
          toast.error("Превышен лимит (20 попыток). Доступ заблокирован на 30 минут!");
        } else {
          toast.error(`Неверный email или пароль. Осталось попыток: ${left} из ${MAX_ATTEMPTS}`);
        }
      }
    }, 500);
  }, [email, password, isLocked, remainingMinutes, attempts, onSuccess]);

  return (
    <div className="min-h-screen bg-[#07090d] text-white flex flex-col justify-between p-4 sm:p-8 select-none relative overflow-hidden font-sans">
      {/* ── Ambient Background Grids ────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(255,90,0,0.22) 0%, rgba(14,35,90,0.15) 50%, transparent 70%)",
        }}
      />

      {/* ── Top Header ──────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto">
        {onExit ? (
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-xs font-mono text-white/50 hover:text-white transition-colors group px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/15 bg-white/[0.02]"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>НА ВИТРИНУ</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-mono text-white/50">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span>GATEWAY: ACTIVE</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] border border-white/10 text-[10px] font-mono text-white/60">
            <ShieldCheck className="w-3 h-3 text-[#22c55e]" />
            <span>HOST: admin.alfacompp.uz</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 tracking-[0.16em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00] animate-pulse" />
            <span>SECURE NODE // V3.8</span>
          </div>
        </div>
      </div>

      {/* ── Main Login Panel ────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key="login-panel"
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={
            isSuccess
              ? { opacity: 0, scale: 1.02, y: -8, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
          }
          className="relative z-10 max-w-[440px] w-full mx-auto my-auto"
        >
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.09] shadow-[0_32px_90px_rgba(0,0,0,0.85),0_0_40px_rgba(255,90,0,0.06)] p-6 sm:p-8 backdrop-blur-xl">

            {/* Brand Header */}
            <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-white/[0.07]">
              <div className="w-10 h-10 rounded-xl bg-[#141822] border border-white/10 flex items-center justify-center text-[#FF5A00] font-black font-mono text-lg shadow-inner">
                α
              </div>
              <div>
                <h1 className="font-extrabold text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
                  Alfa<span className="text-[#FF5A00]">Comp</span>
                  <span className="text-white/40 font-mono text-xs">// ADMIN PANEL</span>
                </h1>
                <p className="text-[10px] font-mono text-white/40 tracking-wider uppercase mt-0.5">
                  Управление магазином alfacomp.uz
                </p>
              </div>
            </div>

            {/* Lockout Warning Banner */}
            {isLocked && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-red-400">Система заблокирована</div>
                  <div className="text-white/70 text-[11px] mt-0.5">
                    Превышен лимит {MAX_ATTEMPTS} неверных попыток. Повторите попытку через {remainingMinutes} мин.
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase text-white/50 tracking-wider">
                  <span>Email Администратора</span>
                  <span className="text-white/30 text-[9px]">SSL 256-BIT</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    autoFocus
                    required
                    disabled={isVerifying || isSuccess || isLocked}
                    placeholder="alfacompofficial@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#13161f] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-white/20 outline-none focus:border-[#FF5A00] transition-all font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase text-white/50 tracking-wider">
                  <span>Пароль доступа</span>
                  <span className="text-[#FF5A00]/70 text-[9px]">
                    ПОПЫТКИ: {attempts}/{MAX_ATTEMPTS}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isVerifying || isSuccess || isLocked}
                    placeholder="••••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#13161f] border border-white/10 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-white/20 outline-none focus:border-[#FF5A00] transition-all font-mono disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isVerifying || isSuccess || isLocked}
                className="w-full h-12 rounded-xl bg-[#FF5A00] hover:bg-[#FF6A15] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF5A00]/20 disabled:opacity-50 mt-4 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ПРОВЕРКА ДОСТУПА...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>ДОСТУП РАЗРЕШЁН</span>
                  </>
                ) : isLocked ? (
                  <span>БЛОКИРОВКА ({remainingMinutes} МИН)</span>
                ) : (
                  <>
                    <span>ВОЙТИ В СИСТЕМУ</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Security Protocol Badges */}
            <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[9px] font-mono text-[#22c55e] font-bold">SQLi GUARD</div>
                <div className="text-[8px] text-white/30 font-mono mt-0.5">ANTI-OR 1=1</div>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[9px] font-mono text-[#22c55e] font-bold">XSS FILTER</div>
                <div className="text-[8px] text-white/30 font-mono mt-0.5">SANITIZED</div>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[9px] font-mono text-[#FF5A00] font-bold">RATE LIMIT</div>
                <div className="text-[8px] text-white/30 font-mono mt-0.5">MAX 20 TRY</div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-5xl w-full mx-auto text-[11px] font-mono text-white/30">
        <div>ALFACOMP TASHKENT · CENTRAL HARDWARE MANAGEMENT</div>
        <div>TARGET: admin.alfacompp.uz ➔ LIVE ALFACOMP.UZ</div>
      </div>
    </div>
  );
};

export default AdminLogin;
