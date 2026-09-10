// Background custom per layar (adzan/iqomah/donasi/acara) - 1 gambar per
// layar, diupload ke Supabase Storage. localStorage/cloud cuma nyimpen URL-nya
// (peta layar -> URL). Kosong (belum upload) = balik ke tampilan tema asli
// lewat CSS.
import { cloudAktif, cloudSet, cloudUploadMedia, cloudDeleteMedia } from "./cloud.js";

const KEY_PETA = "bgLayarFile";

function petaFile() {
  try { return JSON.parse(localStorage.getItem(KEY_PETA)) || {}; }
  catch { return {}; }
}
function simpanPeta(peta) {
  localStorage.setItem(KEY_PETA, JSON.stringify(peta));
  cloudSet(KEY_PETA, peta);
}

function ekstensi(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  return m ? m[1].toLowerCase() : "jpg";
}

// Dipanggil dari admin.js. true = berhasil upload, false = gagal (cloud
// belum dikonfigurasi atau upload gagal).
export async function simpanBgLayar(layar, file) {
  if (!cloudAktif()) return false;
  const nama = `bg-${layar}.${ekstensi(file)}`;
  const urlCloud = await cloudUploadMedia(nama, file);
  if (!urlCloud) return false;

  const peta = petaFile();
  peta[`${layar}Cloud`] = urlCloud;
  simpanPeta(peta);
  return true;
}

export async function hapusBgLayar(layar) {
  const peta = petaFile();
  cloudDeleteMedia(peta[`${layar}Cloud`]); // fire-and-forget, tidak nge-block hapus dari peta
  delete peta[`${layar}Cloud`];
  simpanPeta(peta);
}

export function urlBgLayar(layar) {
  return petaFile()[`${layar}Cloud`] || null;
}

// Dipakai view display (iqomah, qr) - sinkron, cuma baca localStorage + set
// path relatif, gak butuh akses folder/izin sama sekali.
export function terapkanBgLayar(layar, el) {
  const url = urlBgLayar(layar);
  el.style.backgroundImage = url ? `url(${url})` : "";
}
