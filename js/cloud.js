// Primitif sinkronisasi cloud (Supabase) - dipakai cloud-sync.js (sisi
// kiosk, tarik data) dan tiap saveX() di admin (dorong data). Kalau
// js/supabase-config.js masih placeholder kosong, semua fungsi di sini
// no-op diam-diam (lihat cloudAktif()) - aplikasi tetap 100% jalan
// localStorage-only, fitur ini murni tambahan opsional.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

let clientPromise = null;

export function cloudAktif() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Singleton - SATU instance client dipakai seluruh app (termasuk
// cloud-auth.js). Wajib satu instance: sesi login yang dibuat cloud-auth.js
// harus "terlihat" oleh request settings/storage di sini, kalau tidak RLS
// akan menolak tulisan admin walau sudah login (client terpisah = in-memory
// auth state terpisah, tidak otomatis sinkron).
export function getSupabaseClient() {
  if (!cloudAktif()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch(() => null);
  }
  return clientPromise;
}

export async function cloudGet(key) {
  const c = await getSupabaseClient();
  if (!c) return null;
  const { data, error } = await c.from("settings").select("value").eq("key", key).maybeSingle();
  if (error || !data) return null;
  return data.value;
}

export async function cloudGetAll() {
  const c = await getSupabaseClient();
  if (!c) return [];
  const { data, error } = await c.from("settings").select("key,value");
  if (error || !data) return [];
  return data;
}

export async function cloudSetDenganClient(key, value, c) {
  if (!c) return { ok: false, active: true, error: "Supabase client tidak tersedia" };
  const { error } = await c.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
  return error ? { ok: false, active: true, error } : { ok: true, active: true };
}

export function cloudSet(key, value) {
  if (!cloudAktif()) return Promise.resolve({ ok: true, active: false });
  const operasi = getSupabaseClient()
    .then((c) => cloudSetDenganClient(key, value, c))
    .catch((error) => ({ ok: false, active: true, error }));
  const timeout = new Promise((resolve) => setTimeout(() => resolve({
    ok: false, active: true, error: "Timeout sinkronisasi Supabase",
  }), 8000));
  return Promise.race([operasi, timeout]);
}

export async function cloudUploadMedia(path, file) {
  const c = await getSupabaseClient();
  if (!c) return null;
  const { error } = await c.storage.from("media").upload(path, file, { upsert: true });
  if (error) return null;
  // Nama path deterministik (mis. bg-acara.jpg) - CDN/browser bisa nyimpen
  // cache lama walau file di Storage sudah diganti (upsert). Tambah query
  // ?v=<timestamp> supaya URL "beda" tiap upload, forcing fetch ulang.
  const url = cloudUrlMedia(path);
  return url ? `${url}?v=${Date.now()}` : null;
}

// Hapus file di Storage - terima path bare ATAU URL publik penuh (termasuk
// query ?v=... dari cloudUploadMedia), diekstrak sendiri di sini biar
// pemanggil (admin.js) tinggal oper apa yang sudah tersimpan di metadata.
// Mengembalikan boolean agar pengelola media dapat menunda pembersihan yang
// gagal tanpa membuang metadata atau cache aktif secara prematur.
export async function cloudDeleteMedia(urlAtauPath) {
  if (!cloudAktif() || !urlAtauPath) return false;
  const path = urlAtauPath.includes("/media/") ? urlAtauPath.split("/media/")[1].split("?")[0] : urlAtauPath;
  try {
    const c = await getSupabaseClient();
    if (!c) return false;
    const { error } = await c.storage.from("media").remove([path]);
    return !error;
  } catch {
    return false;
  }
}

// Path URL Storage publik Supabase deterministik - tidak butuh network call.
export function cloudUrlMedia(path) {
  if (!cloudAktif()) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

export async function cloudSubscribe(onChange) {
  const c = await getSupabaseClient();
  if (!c) return () => {};
  const channel = c
    .channel("settings-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
      onChange(payload.new || payload.old);
    })
    .subscribe();
  return () => c.removeChannel(channel);
}
