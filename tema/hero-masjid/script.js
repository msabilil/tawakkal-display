// Render daftar waktu sholat + tandai waktu yang sedang berjalan/berikutnya.
// Data waktu di bawah ini dummy — ganti waktuSholat dari sumber jadwal asli
// (API/hitungan lokasi) saat halaman ini diintegrasikan.

const waktuSholat = [
  { id: "subuh", nama: "Subuh", jam: "04:35", ikon: "#ikon-subuh" },
  { id: "dzuhur", nama: "Dzuhur", jam: "11:52", ikon: "#ikon-dzuhur" },
  { id: "ashar", nama: "Ashar", jam: "15:15", ikon: "#ikon-ashar" },
  { id: "maghrib", nama: "Maghrib", jam: "17:48", ikon: "#ikon-maghrib" },
  { id: "isya", nama: "Isya", jam: "19:00", ikon: "#ikon-isya" },
];

function menitDariJam(jamStr) {
  const [j, m] = jamStr.split(":").map(Number);
  return j * 60 + m;
}

// Waktu yang sedang berjalan = waktu terakhir yang sudah lewat (berlaku
// sampai waktu berikutnya tiba). Sebelum Subuh, Isya semalam yang masih
// berjalan; sesudah Isya, Isya sendiri yang berjalan sampai Subuh besok.
function idWaktuAktif(sekarangMenit) {
  let aktif = waktuSholat[waktuSholat.length - 1].id; // default: Isya (belum lewat tengah malam)
  for (const w of waktuSholat) {
    if (menitDariJam(w.jam) <= sekarangMenit) aktif = w.id;
  }
  return aktif;
}

function render() {
  const sekarang = new Date();
  const sekarangMenit = sekarang.getHours() * 60 + sekarang.getMinutes();
  const aktifId = idWaktuAktif(sekarangMenit);

  const ul = document.getElementById("daftarWaktu");
  ul.innerHTML = waktuSholat.map((w) => {
    const aktif = w.id === aktifId;
    return `
      <li class="baris-waktu${aktif ? " aktif" : ""}"${aktif ? ' aria-current="time"' : ""}>
        <span class="ikon"><svg viewBox="0 0 24 24"><use href="${w.ikon}"/></svg></span>
        <span class="nama">${w.nama}</span>
        <span class="jam">${w.jam}</span>
        <span class="badge"><span class="titik"></span>Sekarang</span>
      </li>`;
  }).join("");

  document.getElementById("tanggalMasehi").textContent =
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(sekarang);

  // Kalender Hijriah lewat Intl bawaan browser — tak perlu library konversi manual.
  document.getElementById("tanggalHijriah").textContent =
    new Intl.DateTimeFormat("id-ID-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(sekarang) + " H";
}

render();
setInterval(render, 60 * 1000);
