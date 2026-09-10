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

export const elLayar = document.getElementById("layar-16x9") || document.body;

// Kotak #layar-16x9 ukurannya PIXEL TETAP (lihat css/style.css) - resolusi
// rancangan 1422.22x800, rentang yang sudah dikonfirmasi tampilannya bagus.
// Di sini cuma di-skala UTUH pakai transform:scale() supaya identik 1:1 di
// resolusi berapa pun (font/jarak/kotak semuanya ikut proporsional, tidak
// dihitung ulang per elemen kayak vw/vh/clamp yang jadi aneh di ukuran
// ekstrem). transform-origin default (center) + body flex-center bikin
// hasil skala tetap di tengah layar.
// Math.max (bukan Math.min) - mode "cover": kotak diskalakan sampai MENUTUPI
// seluruh layar (tidak ada hitam kiri-kanan/atas-bawah sama sekali), tepinya
// yang kelebihan otomatis kepotong rapi (overflow:hidden di body), simetris
// karena tetap di-tengah-in. Di TV asli (16:9 persis) ini praktis tidak
// pernah motong apa-apa - beda rasio cuma kejadian pas testing di layar yang
// bukan 16:9 pas (mis. browser belum fullscreen, chrome-nya motong tinggi).
const LEBAR_RANCANGAN = 1422.22;
const TINGGI_RANCANGAN = 800;

function skalakanLayar() {
  if (elLayar.id !== "layar-16x9") return; // admin.html dst - tidak ada kotak ini
  const skala = Math.max(window.innerWidth / LEBAR_RANCANGAN, window.innerHeight / TINGGI_RANCANGAN);
  elLayar.style.transform = `scale(${skala})`;
}

skalakanLayar();
window.addEventListener("resize", skalakanLayar);
window.addEventListener("orientationchange", skalakanLayar);

const daftarView = {}; // nama -> start(opsi) => stop|void
let namaAktif = null;
let stopAktif = null;

export function daftarkan(nama, start) {
  daftarView[nama] = start;
}

export function tampilkan(nama, opsi) {
  const ganti = () => {
    if (stopAktif) stopAktif();
    elLayar.className = KELAS_BODY[nama];
    // Tombol fullscreen/admin (.tombol-grup-mengambang) sengaja di luar
    // #layar-16x9 di index.html - kalau ikut di dalam, posisinya (fixed,
    // inset dari pojok box) bisa kepotong pas box di-skala "cover" (lihat
    // skalakanLayar) sampai tepinya keluar viewport. Class di-mirror ke body
    // biar CSS tema tombol per-halaman (body.layar vs body:not(.layar)) yang
    // tadinya baca #layar-16x9.X tetap jalan walau tombolnya sudah pindah.
    document.body.className = KELAS_BODY[nama];
    elLayar.style.backgroundImage = ""; // reset - view yang butuh bg custom set sendiri lewat bg-layar.js
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
