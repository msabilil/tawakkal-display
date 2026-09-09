// Daftar & gerbang slide "Demo Layar" - dipisah dari demo.js (yang sentuh DOM
// di scope modul) supaya bisa diuji langsung tanpa elemen HTML demo.html.
import { kartuTersedia } from "./rotasi.js";
import { loadJumatSlides } from "./jumat-mode.js";

export const SEMUA_SLIDE = [
  { label: "Jadwal Sholat", src: "index.html?demo=1" },
  { label: "Adzan", src: "index.html?preview=1&view=iqomah&fase=adzan" },
  { label: "Iqomah", src: "index.html?preview=1&view=iqomah&fase=iqomah" },
  { label: "QR Donasi", src: "index.html?preview=1&view=qr", kartu: "qr" },
  { label: "Jadwal Kegiatan", src: "index.html?preview=1&view=kegiatan", kartu: "kegiatan" },
  { label: "Jum'at", src: "index.html?preview=1&view=jumat", perlu: () => loadJumatSlides().length > 0 },
];

// Slide "kartu" (qr/kegiatan) cuma masuk kalau kartuTersedia() -
// gerbang yang sama dipakai rotasi asli - bilang fitur itu memang aktif.
// Slide ber-"perlu" (jum'at) masuk kalau memang ada kontennya.
export function slideAktif(now = new Date()) {
  const kartu = kartuTersedia(now);
  return SEMUA_SLIDE.filter((s) => {
    if (s.kartu) return kartu.includes(s.kartu);
    if (s.perlu) return s.perlu();
    return true;
  });
}
