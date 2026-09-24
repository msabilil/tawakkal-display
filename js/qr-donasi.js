import { loadRotasi, loadQr, lanjutRotasi } from "./rotasi.js";
import { terapkanBgLayar } from "./bg-layar.js";
import { tampilkan, elLayar } from "./navigasi.js";
import { readCache } from "./api.js";
import { jadwalTerkoreksi, ringkasJadwalSholat } from "./jadwal-terkoreksi.js";
import { buatIkonJadwal } from "./ikon-jadwal.js";
import { mulaiJamFokus } from "./jam-fokus.js";

function renderJadwal() {
  const list = document.getElementById("qr-jadwal-list");
  const cache = readCache();
  const jadwal = cache?.jadwal ? ringkasJadwalSholat(jadwalTerkoreksi(cache.jadwal)) : [];
  list.replaceChildren();

  if (!jadwal.length) {
    const kosong = document.createElement("li");
    kosong.className = "jadwal-strip-kosong qr-jadwal-kosong";
    kosong.textContent = "Jadwal hari ini belum tersedia.";
    list.append(kosong);
    return;
  }

  for (const { key, label, jam } of jadwal) {
    const item = document.createElement("li");
    item.dataset.waktu = key;
    item.append(buatIkonJadwal(key));
    const nama = document.createElement("span");
    const waktu = document.createElement("time");
    nama.textContent = label;
    waktu.textContent = jam;
    item.append(nama, waktu);
    list.append(item);
  }
}

// Dipanggil router (navigasi.js) tiap masuk view "qr".
export function start(opsi) {
  terapkanBgLayar("donasi", elLayar);
  const qr = loadQr();
  if (!qr && !opsi.preview) {
    tampilkan("sholat");
    return;
  }
  document.getElementById("qr-judul").textContent = (qr && qr.judul) || "Donasi";
  document.getElementById("qr-gambar").src = qr ? (qr.urlCloud || qr.dataUrl) : "";
  document.getElementById("qr-teks").textContent = (qr && qr.teks) || "";
  renderJadwal();
  const stopJam = mulaiJamFokus();

  if (!opsi.preview) {
    const id = setTimeout(() => lanjutRotasi(new Date()), loadRotasi().qrDonasiDetik * 1000);
    return () => {
      clearTimeout(id);
      stopJam();
    };
  }
  return stopJam;
}
