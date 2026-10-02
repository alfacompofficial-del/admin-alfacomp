import React, { useState } from "react";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";

export default function AdminApp() {
  const [auth, setAuth] = useState<boolean>(() => {
    try { return sessionStorage.getItem("_afc_auth") === "1"; }
    catch { return false; }
  });

  if (!auth) return <AdminLogin onSuccess={() => setAuth(true)} />;
  return <AdminDashboard onLogout={() => setAuth(false)} />;
}
