import { loadRotasi } from "./rotasi.js";
import { loadJadwalPengajian, entriAktif } from "./jadwal-pengajian.js";
import { tampilkan } from "./navigasi.js";

const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_NAMA = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// "YYYY-MM-DD" -> "Senin, 14 Agustus 2025" (bukan cuma "14/08/2025" - lebih
// jelas dibaca dari jauh di layar TV).
function formatTanggalLengkap(tanggalStr) {
  const [y, m, d] = tanggalStr.split("-").map(Number);
  const tgl = new Date(y, m - 1, d);
  return `${HARI_NAMA[tgl.getDay()]}, ${d} ${BULAN_NAMA[m - 1]} ${y}`;
}

function baris(e) {
  const kapan = e.tipe === "mingguan"
    ? `${HARI_NAMA[e.hari]}. Pukul ${e.jam} WIB`
    : `${formatTanggalLengkap(e.tanggal)}. Pukul ${e.jam} WIB`;
  const pengisi = e.pengisi ? `<span class="fokus-item-pengisi">${e.pengisi}</span>` : "";
  return `<li class="fokus-item"><span class="fokus-item-nama">${e.nama}</span><span class="fokus-item-kapan">${kapan}</span>${pengisi}</li>`;
}

// Dipanggil router (navigasi.js) tiap masuk view "kegiatan".
export function start(opsi) {
  const entri = entriAktif(new Date(), loadJadwalPengajian()).slice(0, 8);
  if (!entri.length && !opsi.preview) {
    tampilkan("sholat");
    return;
  }
  const list = document.getElementById("fokus-list");
  list.innerHTML = entri.length ? entri.map(baris).join("") : `<p class="fokus-kosong">Belum ada jadwal kegiatan.</p>`;

  if (!opsi.preview) {
    const id = setTimeout(() => tampilkan("sholat"), loadRotasi().jadwalPengajianDetik * 1000);
    return () => clearTimeout(id);
  }
}
