// Router antar "halaman" di index.html - dulu tiap halaman dokumen terpisah
// (location.href), sekarang cuma section yang di-toggle supaya fullscreen
// browser tidak ke-reset tiap pindah (navigasi dokumen selalu keluar
// fullscreen, lihat fullscreen.js). Modul view daftar sekali lewat
// daftarkan(), lalu tampilkan(nama) yang urus stop view lama + start baru.

const KELAS_BODY = {
  sholat: "layar",
  iqomah: "iqomah-page",
  jumat: "halaman-jumat",
  qr: "halaman-fokus halaman-qr",
  kegiatan: "halaman-fokus halaman-kegiatan",
  hening: "halaman-hening",
  acara: "halaman-acara",
};

const daftarView = {}; // nama -> start(opsi) => stop|void
let namaAktif = null;
let stopAktif = null;

export function daftarkan(nama, start) {
  daftarView[nama] = start;
}

export function tampilkan(nama, opsi) {
  const ganti = () => {
    if (stopAktif) stopAktif();
    document.body.className = KELAS_BODY[nama];
    document.body.style.backgroundImage = ""; // reset - view yang butuh bg custom set sendiri lewat bg-layar.js
    document.querySelectorAll("[data-view]").forEach((el) => {
      el.hidden = el.dataset.view !== nama;
    });
    namaAktif = nama;
    stopAktif = daftarView[nama](opsi || {}) || null;
  };
  if (document.startViewTransition) document.startViewTransition(ganti);
  else ganti();
}

export function viewAktif() {
  return namaAktif;
}
