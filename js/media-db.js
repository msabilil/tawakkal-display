// Wrapper minimal IndexedDB untuk menyimpan Blob audio (murotal offline &
// nada iqomah) sebagai cache lokal, additive di samping upload ke Supabase
// Storage. Semua fungsi menelan error dan mengembalikan nilai netral supaya
// fiturnya bisa dilewati diam-diam kalau IndexedDB tidak tersedia (mis. mode
// private).

import { cloudAktif, cloudDeleteMedia, cloudUploadMedia, cloudUrlMedia } from "./cloud.js";

const DB_NAME = "masjidMediaDB";
const STORE = "media";

// Path Storage buat 1 mediaKey - dipakai baik saat upload maupun saat
// murotal.js mau cek apakah ada versi cloud sebelum fallback ke Blob
// IndexedDB lokal (offline media tidak ikut ke tabel `settings` - ukurannya
// bisa besar, jadi lewat Storage seperti bg-layar.js).
export function cloudUrlUntukMedia(mediaKey) {
  if (!cloudAktif()) return null;
  return cloudUrlMedia(`offline/${mediaKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
}

function openDB() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMedia(key, blob) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    if (cloudAktif()) {
      cloudUploadMedia(`offline/${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`, blob).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export async function getMedia(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function delMedia(key) {
  try {
    // Jangan hapus cache lokal lebih dulu ketika cloud sedang aktif. Bila
    // penghapusan cloud gagal, kiosk tetap memakai audio lama daripada UI
    // menjanjikan beep/default sementara device lain masih memutar file itu.
    if (cloudAktif()) {
      const terhapusDiCloud = await cloudDeleteMedia(`offline/${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
      if (!terhapusDiCloud) return false;
    }
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}
