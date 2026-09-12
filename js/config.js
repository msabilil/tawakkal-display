export const ID_KOTA = "1219";
export const NAMA_MASJID = "Masjid At-Tawakkal 2";
export const TAGLINE_MASJID = "Kebersamaan dalam kebaikan";
export const LOKASI_LABEL = "Astana Anyar, Kota Bandung";

// Teks pengumuman berjalan di footer layar utama (default/fallback). Bisa
// diubah lewat admin (lihat js/settings.js loadPengumuman/savePengumuman) -
// array ini cuma dipakai kalau belum ada yang tersimpan di localStorage.
export const PENGUMUMAN = [
  "Lurus dan rapatkan shaf untuk kesempurnaan sholat berjamaah.",
  "Mohon matikan atau senyapkan nada dering ponsel saat berada di dalam ruang utama masjid.",
  "Salurkan infaq, sedekah, dan wakaf terbaik Anda melalui kotak amal atau QRIS resmi masjid.",
];

// Semua waktu yang ditampilkan di grid layar utama, urut kronologis.
// `sholat: true` menandai waktu yang punya iqomah dan dihitung sebagai "sholat berikutnya".
// Imsak & Terbit hanya informasi, bukan waktu sholat.
export const WAKTU_HARIAN = [
  { key: "imsak", label: "Imsak", icon: "moon-stars", sholat: false },
  { key: "subuh", label: "Subuh", icon: "sunrise", sholat: true },
  { key: "terbit", label: "Terbit", icon: "sun-low", sholat: false },
  { key: "dzuhur", label: "Dzuhur", icon: "sun-high", sholat: true },
  { key: "ashar", label: "Ashar", icon: "sun", sholat: true },
  { key: "maghrib", label: "Maghrib", icon: "sunset", sholat: true },
  { key: "isya", label: "Isya", icon: "moon", sholat: true },
];

export const SHOLAT = WAKTU_HARIAN.filter((w) => w.sholat).map(({ key, label }) => ({ key, label }));

export const DEFAULT_IQOMAH = {
  subuh: { menit: 10, aktif: true },
  dzuhur: { menit: 10, aktif: true },
  ashar: { menit: 10, aktif: true },
  maghrib: { menit: 5, aktif: true },
  isya: { menit: 10, aktif: true },
};

export const QORI = {
  "01": "Abdullah Al-Juhany",
  "02": "Abdul Muhsin Al-Qasim",
  "03": "Abdurrahman as-Sudais",
  "04": "Ibrahim Al-Dossari",
  "05": "Misyari Rasyid Al-Afasi",
  "06": "Yasser Al-Dosari",
};

// Durasi layar Adzan (hitung mundur sendiri) sebelum otomatis pindah ke layar
// Iqomah (hitung mundur terpisah, penuh sesuai menit jeda di DEFAULT_IQOMAH -
// lihat app.js mulaiIqomah, dua durasi ini independen/berurutan, bukan dipotong).
export const DEFAULT_ADZAN = { menit: 5 };

// Durasi slide Jum'at setelah layar Adzan Dzuhur. Cuma aktif kalau ada
// minimal 1 slide tersimpan (lihat jumat-mode.js jumatState).
export const DEFAULT_JUMAT = { durasiMenit: 60, sholatModeAktif: true };

// Durasi bunyi untuk notifikasi ketika fase Iqomah dan Sholat Mode dimulai.
// File audio akan diulang sampai durasi ini habis agar nada pendek pun tetap
// terdengar sesuai waktu yang dipilih admin.
export const DEFAULT_NADA = { iqomahDetik: 8, sholatModeDetik: 8 };

// Playlist bawaan (tanpa perlu setting) - streaming langsung dari CDN
// EQuran.id, pola URL-nya sama dengan yang dipakai fitur "Tambah dari API"
// di admin (lihat js/admin.js tambahApiMurotal): audio-full/<Nama-Qori>/<no-3-digit>.mp3
const QORI_BAWAAN = "05"; // Misyari Rasyid Al-Afasi
const SURAH_BAWAAN = [
  { nomor: 36, nama: "Yasin" },
  { nomor: 18, nama: "Al-Kahfi" },
  { nomor: 67, nama: "Al-Mulk" },
];
function urlMurotalBawaan(nomor) {
  const slug = QORI[QORI_BAWAAN].replace(/ /g, "-");
  return `https://cdn.equran.id/audio-full/${slug}/${String(nomor).padStart(3, "0")}.mp3`;
}

export const DEFAULT_MUROTAL = {
  aktif: true,
  mulaiMenit: 15,             // mulai murotal X menit sebelum jam sholat
  berhentiMenit: 3,           // berhenti Y menit sebelum jam sholat (0 = sampai pas adzan)
  perSholat: { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true },
  // item: {id,tipe:"offline",label,mediaKey} atau {id,tipe:"api",label,surah,qori,url}
  playlist: SURAH_BAWAAN.map(({ nomor, nama }) => ({
    id: `bawaan-${nomor}`,
    tipe: "api",
    surah: nomor,
    qori: QORI_BAWAAN,
    label: `${nama} - ${QORI[QORI_BAWAAN]}`,
    url: urlMurotalBawaan(nomor),
  })),
  posisi: { index: 0, detik: 0 },
};

// sholatDetik: berapa lama layar jadwal sholat tampil sebelum gantian ke
// layar QR/kegiatan berikutnya (kalau ada isinya).
export const DEFAULT_ROTASI = { sholatDetik: 60, jadwalPengajianDetik: 20, qrDonasiDetik: 15 };

// Kegiatan Terdekat: layar poster (cuma foto latar, tanpa teks) yang tampil
// otomatis di rentang menit sebelum/sesudah SETIAP waktu sholat (bukan
// pilih sholat tertentu). "sebelum" dihitung dari jam azan (mundur).
// "sesudah" dihitung dari SELESAI hening (bukan dari azan mentah) - biar
// tidak pernah ketutup adzan/iqomah/hening yang prioritasnya lebih tinggi;
// kalau hening nonaktif buat sholat itu, otomatis jadi dari selesai iqomah.
// mode "selalu" = lewati semua window, langsung masuk rotasi utama seperti
// QR/Jadwal Kegiatan (tetap butuh gambar ter-upload).
export const DEFAULT_ACARA = {
  mode: "waktu",
  sebelum: { aktif: true, mulaiMenit: 30, selesaiMenit: 5 },
  sesudah: { aktif: true, mulaiMenit: 5, selesaiMenit: 30 },
};

// Layar hening (hitam polos) setelah iqomah kelar - per sholat, biar tidak
// mengganggu sebelum jamaah bubar. "menit" dihitung dari SELESAI iqomah
// (bukan dari azan). Jumat dzuhur otomatis dilewati sama seperti Iqomah.
export const DEFAULT_HENING = {
  subuh: { menit: 10, aktif: true },
  dzuhur: { menit: 10, aktif: true },
  ashar: { menit: 10, aktif: true },
  maghrib: { menit: 10, aktif: true },
  isya: { menit: 10, aktif: true },
};

// Tarawih: jedaMenit dihitung dari selesai iqomah Isya sampai tarawih mulai,
// durasiMenit lama layar hening tampil (mewakili tarawih+witir berlangsung).
// Default deteksi Ramadhan ikut kalender Hijriah (lihat ramadhan.js
// isRamadhan) - tanggalMulai/tanggalSelesai ("YYYY-MM-DD", Masehi) override
// manual kalau admin isi KEDUANYA (mis. sesuai tanggal resmi Kemenag),
// kosong = ikut kalender otomatis. nonaktif matikan total musim ini.
export const DEFAULT_TARAWIH = { jedaMenit: 10, durasiMenit: 45, tanggalMulai: "", tanggalSelesai: "", nonaktif: false };
