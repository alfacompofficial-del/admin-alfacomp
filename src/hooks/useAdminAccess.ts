import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Список разрешённых IP для административной панели
const ALLOWED_ADMIN_IPS: string[] = [
  "144.124.196.58", // Персональный IP администратора
];

const CACHE_KEY = "admin_ip_cache_v3";
const CACHE_ALLOWED_KEY = "admin_allowed_v3";
const VISIT_LOGGED_KEY = "visit_logged_v1";

const getPersistedResult = (): boolean | null => {
  try {
    const ip = localStorage.getItem(CACHE_KEY);
    const allowed = localStorage.getItem(CACHE_ALLOWED_KEY);
    if (ip && allowed !== null) return allowed === "1";
  } catch {}
  return null;
};

let cachedAllowed: boolean | null = getPersistedResult();
let inflight: Promise<boolean> | null = null;

export const isLocalhost = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
};

const isAllowedIp = (ip: string | null): boolean => {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, "");
  return ALLOWED_ADMIN_IPS.includes(normalized);
};

const logVisit = async (info: {
  ip: string;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
}) => {
  try {
    if (sessionStorage.getItem(VISIT_LOGGED_KEY) === "1") return;
    sessionStorage.setItem(VISIT_LOGGED_KEY, "1");
    await supabase.from("visitors").insert({
      ip: info.ip,
      country: info.country ?? null,
      country_code: info.country_code ?? null,
      city: info.city ?? null,
      region: info.region ?? null,
      user_agent: navigator.userAgent,
      path: window.location.pathname + window.location.hash,
      referrer: document.referrer || null,
    });
  } catch {}
};

const fetchIpInfo = async (): Promise<{ ip: string; country?: string; country_code?: string; city?: string; region?: string } | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d.ip) return {
        ip: d.ip,
        country: d.country_name,
        country_code: d.country_code,
        city: d.city,
        region: d.region,
      };
    }
  } catch {}

  for (const url of ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const d = await res.json();
      if (d.ip) return { ip: d.ip };
    } catch {}
  }
  return null;
};

export const isUserAdmin = (): boolean => {
  if (typeof window === "undefined") return false;
  if (isLocalhost()) return true;
  return cachedAllowed === true;
};

const checkAccess = async (): Promise<boolean> => {
  if (isLocalhost()) {
    cachedAllowed = true;
    try {
      localStorage.setItem(CACHE_KEY, "localhost");
      localStorage.setItem(CACHE_ALLOWED_KEY, "1");
    } catch {}
    return true;
  }

  const info = await fetchIpInfo();
  if (info) {
    logVisit(info);
    const allowed = isAllowedIp(info.ip);
    cachedAllowed = allowed;
    try {
      localStorage.setItem(CACHE_KEY, info.ip);
      localStorage.setItem(CACHE_ALLOWED_KEY, allowed ? "1" : "0");
    } catch {}
    return allowed;
  }

  const fallback = cachedAllowed ?? false;
  return fallback;
};

export const useAdminAccess = () => {
  const [allowed, setAllowed] = useState<boolean>(() => {
    if (isLocalhost()) return true;
    return cachedAllowed ?? false;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (isLocalhost()) return false;
    return cachedAllowed === null;
  });

  useEffect(() => {
    if (isLocalhost()) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    if (cachedAllowed !== null) {
      setAllowed(cachedAllowed);
      setLoading(false);
    }

    if (!inflight) {
      inflight = checkAccess().finally(() => {
        inflight = null;
      });
    }

    inflight.then((res) => {
      setAllowed(res);
      setLoading(false);
    });
  }, []);

  return { allowed, loading };
};
