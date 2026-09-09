// Registry versi tampilan layar utama (skin seluruh halaman, lihat
// css/versi-baru.css & css/versi-biru.css). Beda dari registry tema/* lain: tidak
// ada modul JS untuk di-"muat", cukup localStorage + atribut data-versi yang
// sudah dibaca index.html.
// Tambah versi baru = tambah entri di sini + CSS `html[data-versi="id"] {...}`
// + satu file tema/tampilan/<id>.png.
export const TEMA_TAMPILAN = {
  lama: { label: "Tosca" },
  baru: { label: "Zamrud Emas" },
  biru: { label: "Masjid Biru" },
};
