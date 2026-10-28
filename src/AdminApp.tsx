import React, { useState } from "react";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import { useAdminAccess } from "./hooks/useAdminAccess";

export default function AdminApp() {
  const { allowed, loading } = useAdminAccess();
  const [auth, setAuth] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem("_afc_auth") === "1" ||
        sessionStorage.getItem("alfacomp_admin_auth") === "1"
      );
    } catch {
      return false;
    }
  });

  const handleLogout = () => {
    try {
      sessionStorage.removeItem("_afc_auth");
      sessionStorage.removeItem("alfacomp_admin_auth");
      sessionStorage.removeItem("alfacomp_admin_auth_time");
      sessionStorage.removeItem("alfacomp_admin_email");
      localStorage.removeItem("alfacomp_admin_auth");
    } catch {}
    setAuth(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center font-mono text-white/50 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span>INITIALIZING SECURE SESSION...</span>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#0d1017] border border-white/10 text-white font-mono space-y-4 shadow-2xl">
          <div className="text-red-400 text-3xl font-bold">404</div>
          <div className="text-white/70 text-xs tracking-wider">PAGE NOT FOUND // ACCESS RESTRICTED</div>
          <div className="text-[11px] text-white/30 pt-4 border-t border-white/5">
            ALFACOMP SECURITY PROTOCOL · HOST: admin.alfacomp.uz
          </div>
        </div>
      </div>
    );
  }

  if (!auth) {
    return (
      <AdminLogin
        onSuccess={() => {
          try {
            sessionStorage.setItem("_afc_auth", "1");
            sessionStorage.setItem("alfacomp_admin_auth", "1");
          } catch {}
          setAuth(true);
        }}
      />
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
