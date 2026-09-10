import { loadRotasi, lanjutRotasi } from "./rotasi.js";
import { terapkanBgLayar, urlBgLayar } from "./bg-layar.js";
import { tampilkan } from "./navigasi.js";

// Dipanggil router (navigasi.js) tiap masuk view "acara".
export function start(opsi) {
  terapkanBgLayar("acara", document.body);
  if (!urlBgLayar("acara") && !opsi.preview) {
    tampilkan("sholat");
    return;
  }

  if (!opsi.preview) {
    const id = setTimeout(() => lanjutRotasi(new Date()), loadRotasi().acaraDetik * 1000);
    return () => clearTimeout(id);
  }
}
