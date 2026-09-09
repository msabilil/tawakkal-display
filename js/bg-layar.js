// Background custom per layar (adzan/iqomah/donasi) - 1 gambar per layar,
// ditulis sebagai file asli ke img/ (lewat folder-proyek.js), bukan Blob di
// IndexedDB. localStorage cuma nyimpen nama filenya (peta layar -> nama).
// Kosong (belum upload) = balik ke tampilan tema asli lewat CSS.
import { ambilFolderImg } from "./folder-proyek.js";

const KEY_PETA = "bgLayarFile";

function petaFile() {
  try { return JSON.parse(localStorage.getItem(KEY_PETA)) || {}; }
  catch { return {}; }
}
function simpanPeta(peta) { localStorage.setItem(KEY_PETA, JSON.stringify(peta)); }

function ekstensi(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  return m ? m[1].toLowerCase() : "jpg";
}

// Dipanggil dari admin.js. true = berhasil, false = gagal (folder img/
// belum dipilih, izin ditolak, atau gagal nulis file).
export async function simpanBgLayar(layar, file) {
  const dirImg = await ambilFolderImg();
  if (!dirImg) return false;
  const nama = `bg-${layar}.${ekstensi(file)}`;
  try {
    const handle = await dirImg.getFileHandle(nama, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch {
    return false;
  }
  const peta = petaFile();
  peta[layar] = nama;
  simpanPeta(peta);
  return true;
}

export async function hapusBgLayar(layar) {
  const peta = petaFile();
  const nama = peta[layar];
  if (!nama) return;
  const dirImg = await ambilFolderImg();
  if (dirImg) {
    try { await dirImg.removeEntry(nama); } catch { /* diam, tetap bersihkan peta */ }
  }
  delete peta[layar];
  simpanPeta(peta);
}

export function urlBgLayar(layar) {
  const nama = petaFile()[layar];
  return nama ? `img/${nama}` : null;
}

// Dipakai view display (iqomah, qr) - sinkron, cuma baca localStorage + set
// path relatif, gak butuh akses folder/izin sama sekali.
export function terapkanBgLayar(layar, el) {
  const url = urlBgLayar(layar);
  el.style.backgroundImage = url ? `url(${url})` : "";
}
