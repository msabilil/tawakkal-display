// Background custom per layar (adzan/iqomah/donasi/acara) - 1 gambar per
// layar, diupload ke Supabase Storage. localStorage/cloud cuma nyimpen URL-nya
// (peta layar -> URL). Kosong (belum upload) = balik ke tampilan tema asli
// lewat CSS.
import { cloudAktif } from "./cloud.js";
import { simpanPengaturan } from "./penyimpanan-pengaturan.js";
import { hapusMedia, simpanMedia } from "./kelola-media.js";

const KEY_PETA = "bgLayarFile";

function petaFile() {
  try { return JSON.parse(localStorage.getItem(KEY_PETA)) || {}; }
  catch { return {}; }
}
function simpanPeta(peta) {
  return simpanPengaturan(KEY_PETA, peta);
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
  const peta = petaFile();
  return simpanMedia({
    file,
    nama,
    mediaLama: peta[`${layar}Cloud`],
    buatMetadata: (urlCloud) => ({ ...peta, [`${layar}Cloud`]: urlCloud }),
    simpanMetadata: simpanPeta,
  });
}

export async function hapusBgLayar(layar) {
  const peta = petaFile();
  const key = `${layar}Cloud`;
  return hapusMedia({
    media: peta[key],
    buatMetadata: () => { const baru = { ...peta }; delete baru[key]; return baru; },
    simpanMetadata: simpanPeta,
  });
}

export function urlBgLayar(layar) {
  return petaFile()[`${layar}Cloud`] || null;
}

// Dipakai view display (iqomah, qr) - sinkron, cuma baca localStorage + set
// path relatif, gak butuh akses folder/izin sama sekali.
export function terapkanBgLayar(layar, el) {
  const url = urlBgLayar(layar);
  if (url) el.style.setProperty("background-image", `url(${url})`, "important");
  else el.style.removeProperty("background-image");
}
