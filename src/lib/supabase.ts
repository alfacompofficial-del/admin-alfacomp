import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "https://vtlzfcjxpnrsqlsrvyer.supabase.co";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "sb_publishable_Ieiof0ojLifGDUpgD6ldVA_utmqM2nZ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
