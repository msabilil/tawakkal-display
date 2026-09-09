// Entry point tunggal index.html - daftarkan tiap view lalu nyalakan yang
// pertama. Lihat navigasi.js buat router-nya.
import { setupFullscreen } from "./fullscreen.js";
import { daftarkan, tampilkan } from "./navigasi.js";
import { start as startSholat, initSekali as initSekaliSholat } from "./app.js";
import { start as startIqomah } from "./iqomah.js";
import { start as startJumat } from "./jumat.js";
import { start as startQr } from "./qr-donasi.js";
import { start as startKegiatan } from "./jadwal-kegiatan.js";

setupFullscreen();
initSekaliSholat(); // pasang listener murotal + jam analog sekali (bukan tiap balik ke view sholat)

daftarkan("sholat", startSholat);
daftarkan("iqomah", startIqomah);
daftarkan("jumat", startJumat);
daftarkan("qr", startQr);
daftarkan("kegiatan", startKegiatan);

const params = new URLSearchParams(location.search);
const viewPreview = params.get("view");
if (params.get("preview") === "1" && viewPreview) {
  tampilkan(viewPreview, { preview: true, fase: params.get("fase") });
} else {
  tampilkan("sholat", {});
}
