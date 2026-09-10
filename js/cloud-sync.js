// Sisi kiosk lapisan sync cloud - tarik tabel `settings` Supabase ke
// localStorage saat boot + realtime + polling. Modul lain (app.js, rotasi.js,
// dll) TIDAK berubah sama sekali - mereka baca localStorage seperti biasa,
// cuma sekarang isinya bisa dimutakhirkan dari luar device ini.
import { cloudAktif, cloudGetAll, cloudSubscribe } from "./cloud.js";

const POLL_MS = 60000;

// Diekspor terpisah dari mulaiCloudSync() supaya bisa diuji tanpa network -
// satu-satunya bagian yang non-trivial (mapping rows -> localStorage keys).
export function tulisKeLocal(rows) {
  for (const row of rows) {
    try {
      localStorage.setItem(row.key, JSON.stringify(row.value));
    } catch {
      // kuota localStorage penuh dsb - diam-diam, lihat pola existing (QR donasi)
    }
  }
}

async function pullSekali() {
  const rows = await cloudGetAll();
  tulisKeLocal(rows);
}

// Dipanggil sekali dari kiosk.js SEBELUM tampilkan("sholat") pertama. Pull
// awal dikasih timeout 3 detik biar internet lambat/mati tidak macetkan
// boot kiosk - kalau timeout, lanjut pakai localStorage yang sudah ada
// (mirror dari sync sebelumnya, atau default tiap modul kalau kiosk baru).
export async function mulaiCloudSync() {
  if (!cloudAktif()) return;

  await Promise.race([pullSekali(), new Promise((resolve) => setTimeout(resolve, 3000))]);

  cloudSubscribe((row) => {
    if (row && row.key) tulisKeLocal([row]);
  });

  setInterval(pullSekali, POLL_MS);
}
