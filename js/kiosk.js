// Entry point tunggal index.html - daftarkan tiap view lalu nyalakan yang
// pertama. Lihat navigasi.js buat router-nya.
import { setupFullscreen } from "./fullscreen.js";
import { daftarkan, tampilkan } from "./navigasi.js";
import { mulaiCloudSync } from "./cloud-sync.js";
import { start as startSholat, initSekali as initSekaliSholat } from "./app.js";
import { start as startIqomah } from "./iqomah.js";
import { start as startJumat } from "./jumat.js";
import { start as startQr } from "./qr-donasi.js";
import { start as startKegiatan } from "./jadwal-kegiatan.js";
import { start as startHening } from "./hening.js";
import { start as startAcara } from "./acara.js";

// Tema (data-versi) dikunci sekali di inline script <head> - sebelum cloud
// sync sempat jalan, jadi device baru/beda selalu mulai dari default "lama"
// dulu. Re-apply di sini tiap kali sync update localStorage (pull awal,
// realtime, polling) supaya tema ikut cloud tanpa perlu reload manual.
function terapkanTemaTampilan() {
  const raw = localStorage.getItem("versiTampilan");
  let v = "lama";
  if (raw) { try { v = JSON.parse(raw); } catch { v = raw; } }
  document.documentElement.setAttribute("data-versi", v);
}

setupFullscreen();
initSekaliSholat(); // pasang listener murotal + jam analog sekali (bukan tiap balik ke view sholat)
await mulaiCloudSync(terapkanTemaTampilan); // no-op kalau supabase-config.js masih kosong

daftarkan("sholat", startSholat);
daftarkan("iqomah", startIqomah);
daftarkan("jumat", startJumat);
daftarkan("qr", startQr);
daftarkan("kegiatan", startKegiatan);
daftarkan("hening", startHening);
daftarkan("acara", startAcara);

const params = new URLSearchParams(location.search);
const viewPreview = params.get("view");
if (params.get("preview") === "1" && viewPreview) {
  tampilkan(viewPreview, { preview: true, fase: params.get("fase") });
} else {
  tampilkan("sholat", {});
}
