import { loadRotasi, lanjutRotasi } from "./rotasi.js";
import { loadJadwalPengajian, entriAktif } from "./jadwal-pengajian.js";
import { tampilkan } from "./navigasi.js";
import { readCache } from "./api.js";
import { jadwalTerkoreksi, ringkasJadwalSholat } from "./jadwal-terkoreksi.js";
import { buatIkonJadwal } from "./ikon-jadwal.js";
import { mulaiJamFokus } from "./jam-fokus.js";

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

// Date -> "14 Agu 2025" (bukan "14/08/2025" - lebih jelas dibaca dari jauh di
// layar TV, tapi tetap ringkas biar muat 1 baris di kotak kegiatan yang
// sempit - nama hari sengaja tidak ditulis penuh karena redundan dgn tanggal).
function formatTanggal(tgl) {
  return `${tgl.getDate()} ${BULAN_PENDEK[tgl.getMonth()]} ${tgl.getFullYear()}`;
}

// entriAktif() sudah lekatkan _waktu (Date kejadian berikutnya, tanggal
// konkret), _jam & _pengisi (efektif - hasil override per-tanggal/rotasi utk seri mingguan).
function baris(e) {
  const jamTeks = e._jam ? `, Pukul ${e._jam} WIB` : "";
  const kapan = `${formatTanggal(e._waktu)}${jamTeks}`;
  const pengisi = e._pengisi ? `<span class="fokus-item-pengisi" style="color:#000 !important">${e._pengisi}</span>` : "";
  return `<li class="fokus-item"><span class="fokus-item-nama">${e.nama}</span><span class="fokus-item-kapan">${kapan}</span>${pengisi}</li>`;
}

function renderJadwalSalat() {
  const list = document.getElementById("kegiatan-jadwal-list");
  const cache = readCache();
  const jadwal = cache?.jadwal ? ringkasJadwalSholat(jadwalTerkoreksi(cache.jadwal)) : [];
  list.replaceChildren();

  if (!jadwal.length) {
    const kosong = document.createElement("li");
    kosong.className = "jadwal-strip-kosong";
    kosong.textContent = "Jadwal hari ini belum tersedia.";
    list.append(kosong);
    return;
  }

  for (const { key, label, jam } of jadwal) {
    const item = document.createElement("li");
    item.dataset.waktu = key;
    const nama = document.createElement("span");
    const waktu = document.createElement("time");
    nama.textContent = label;
    waktu.textContent = jam;
    item.append(buatIkonJadwal(key), nama, waktu);
    list.append(item);
  }
}

// Dipanggil router (navigasi.js) tiap masuk view "kegiatan".
export function start(opsi) {
  const entri = entriAktif(new Date(), loadJadwalPengajian()).slice(0, 6);
  if (!entri.length && !opsi.preview) {
    tampilkan("sholat");
    return;
  }
  const list = document.getElementById("fokus-list");
  list.innerHTML = entri.length ? entri.map(baris).join("") : `<p class="fokus-kosong">Belum ada jadwal kegiatan.</p>`;
  renderJadwalSalat();
  const stopJam = mulaiJamFokus();

  if (!opsi.preview) {
    const id = setTimeout(() => lanjutRotasi(new Date()), loadRotasi().jadwalPengajianDetik * 1000);
    return () => {
      clearTimeout(id);
      stopJam();
    };
  }
  return stopJam;
}
