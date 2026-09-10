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

// Fire-and-forget dengan sengaja - pemanggil (saveX() di admin.js) tidak
// boleh nunggu network, biar UI admin tetap instan seperti sekarang.
export function cloudSet(key, value) {
  if (!cloudAktif()) return;
  getSupabaseClient()
    .then((c) => c && c.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }))
    .catch(() => {}); // gagal diam-diam, lihat spec bagian Error Handling
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
// Fire-and-forget sama seperti cloudSet - gagal diam-diam, tidak nge-block
// hapus dari daftar/metadata yang sudah jalan lebih dulu.
export function cloudDeleteMedia(urlAtauPath) {
  if (!cloudAktif() || !urlAtauPath) return;
  const path = urlAtauPath.includes("/media/") ? urlAtauPath.split("/media/")[1].split("?")[0] : urlAtauPath;
  getSupabaseClient()
    .then((c) => c && c.storage.from("media").remove([path]))
    .catch(() => {});
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
