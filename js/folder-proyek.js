// Akses folder img/ project di disk kiosk lewat File System Access API - dipakai
// admin.js buat nulis file background/slide LANGSUNG ke situ (file asli di
// disk, bukan blob di IndexedDB). Cuma jalan di Chrome/Edge, dan admin.html
// wajib dibuka lewat http://localhost (showDirectoryPicker butuh secure
// context, gagal di file://).
import { getMedia, putMedia } from "./media-db.js";

const KEY_HANDLE = "folderImgHandle"; // disimpan di media-db - handle folder bukan Blob, tapi tetap structured-cloneable

export function fsaTersedia() {
  return typeof window.showDirectoryPicker === "function";
}

// Minta user pilih folder img/ project ini langsung (bukan folder root).
export async function pilihFolderImg() {
  const handle = await window.showDirectoryPicker({ id: "jadwal-sholat-img", mode: "readwrite" });
  await putMedia(KEY_HANDLE, handle);
  return handle;
}

async function handleTersimpan() {
  return getMedia(KEY_HANDLE);
}

export async function folderImgDipilih() {
  return !!(await handleTersimpan());
}

async function pastikanIzin(handle) {
  const opt = { mode: "readwrite" };
  if ((await handle.queryPermission(opt)) === "granted") return true;
  return (await handle.requestPermission(opt)) === "granted";
}

// Handle folder img/ yang sudah dipilih. null kalau belum pilih folder atau
// izin ditolak (caller tinggal tampilkan pesan gagal).
export async function ambilFolderImg() {
  const handle = await handleTersimpan();
  if (!handle) return null;
  if (!(await pastikanIzin(handle))) return null;
  return handle;
}
