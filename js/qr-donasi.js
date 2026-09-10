import { loadRotasi, loadQr, lanjutRotasi } from "./rotasi.js";
import { terapkanBgLayar } from "./bg-layar.js";
import { tampilkan, elLayar } from "./navigasi.js";

// Dipanggil router (navigasi.js) tiap masuk view "qr".
export function start(opsi) {
  terapkanBgLayar("donasi", elLayar);
  const qr = loadQr();
  if (!qr && !opsi.preview) {
    tampilkan("sholat");
    return;
  }
  document.getElementById("qr-judul").textContent = (qr && qr.judul) || "Donasi";
  document.getElementById("qr-gambar").src = qr ? qr.dataUrl : "";
  document.getElementById("qr-teks").textContent = (qr && qr.teks) || "";

  if (!opsi.preview) {
    const id = setTimeout(() => lanjutRotasi(new Date()), loadRotasi().qrDonasiDetik * 1000);
    return () => clearTimeout(id);
  }
}
