// Login/logout admin lewat Supabase Auth. Pakai client singleton dari
// cloud.js (getSupabaseClient) - JANGAN bikin createClient() baru di sini,
// kalau tidak sesi login tidak ikut "terlihat" oleh request settings/storage
// di cloud.js (RLS akan menolak diam-diam meski sudah login).
import { getSupabaseClient } from "./cloud.js";

export async function sesiAktif() {
  const c = await getSupabaseClient();
  if (!c) return false;
  const { data } = await c.auth.getSession();
  return Boolean(data && data.session);
}

export async function login(email, password) {
  const c = await getSupabaseClient();
  if (!c) return { ok: false, pesan: "Cloud belum dikonfigurasi." };
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, pesan: "Email atau password salah." };
  return { ok: true };
}

export async function logout() {
  const c = await getSupabaseClient();
  if (c) await c.auth.signOut();
}
