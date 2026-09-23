import { cloudDeleteMedia, cloudUploadMedia } from "./cloud.js";

const KEY_PEMBERSIHAN = "pembersihanMediaTertunda";

function bacaAntrean() {
  try { return JSON.parse(localStorage.getItem(KEY_PEMBERSIHAN)) || []; }
  catch { return []; }
}

function tulisAntrean(antrean) {
  try {
    if (antrean.length) localStorage.setItem(KEY_PEMBERSIHAN, JSON.stringify(antrean));
    else localStorage.removeItem(KEY_PEMBERSIHAN);
  } catch {
    // Pembersihan tidak boleh menghapus media aktif hanya karena kuota lokal.
  }
}

function antrekan(url) {
  if (!url) return;
  const antrean = bacaAntrean();
  if (!antrean.includes(url)) tulisAntrean([...antrean, url]);
}

export async function cobaUlangPembersihanMedia({ hapus = cloudDeleteMedia } = {}) {
  const sisa = [];
  for (const url of bacaAntrean()) {
    if (!(await hapus(url))) sisa.push(url);
  }
  tulisAntrean(sisa);
  return { tertunda: sisa.length };
}

export async function simpanMedia({ file, nama, buatMetadata, simpanMetadata, mediaLama, unggah = cloudUploadMedia, hapus = cloudDeleteMedia }) {
  const urlBaru = await unggah(nama, file);
  if (!urlBaru) return { ok: false, tahap: "unggah" };

  let hasilMetadata;
  try {
    hasilMetadata = await simpanMetadata(buatMetadata(urlBaru));
  } catch {
    hasilMetadata = null;
  }
  const metadataTersimpan = !!hasilMetadata && (hasilMetadata.lokal || hasilMetadata.cloud?.ok);
  if (!metadataTersimpan) {
    if (!(await hapus(urlBaru))) antrekan(urlBaru);
    return { ok: false, tahap: "metadata" };
  }

  let pembersihanTertunda = false;
  if (mediaLama && mediaLama.split("?")[0] !== urlBaru.split("?")[0]) {
    if (!(await hapus(mediaLama))) { antrekan(mediaLama); pembersihanTertunda = true; }
  }
  return { ok: true, pembersihanTertunda, hasilMetadata };
}

export async function hapusMedia({ buatMetadata, simpanMetadata, media, hapus = cloudDeleteMedia }) {
  let hasilMetadata;
  try { hasilMetadata = await simpanMetadata(buatMetadata()); } catch { hasilMetadata = null; }
  const metadataTersimpan = !!hasilMetadata && (hasilMetadata.lokal || hasilMetadata.cloud?.ok);
  if (!metadataTersimpan) return { ok: false, tahap: "metadata" };
  const pembersihanTertunda = !!media && !(await hapus(media));
  if (pembersihanTertunda) antrekan(media);
  return { ok: true, pembersihanTertunda, hasilMetadata };
}
