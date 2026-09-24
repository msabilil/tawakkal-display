// Sisi kiosk lapisan sync cloud - tarik tabel `settings` Supabase ke
// localStorage saat boot + Broadcast Realtime. Modul lain (app.js, rotasi.js,
// dll) TIDAK berubah sama sekali - mereka baca localStorage seperti biasa,
// cuma sekarang isinya bisa dimutakhirkan dari luar device ini.
import { cloudAktif, cloudGetAll, cloudSubscribe } from "./cloud.js";
import { cobaUlangPengaturanTertunda, terapkanDariCloud } from "./penyimpanan-pengaturan.js";

function pertahankanPosisiMurotal(rows) {
  return rows.map((row) => {
    if (!row || row.key !== "murotalSettings") return row;
    try {
      const lokal = JSON.parse(localStorage.getItem(row.key));
      if (!lokal || !lokal.posisi) return row;
      return { ...row, value: { ...row.value, posisi: lokal.posisi } };
    } catch {
      return row;
    }
  });
}

// Diekspor terpisah dari mulaiCloudSync() supaya bisa diuji tanpa network -
// satu-satunya bagian yang non-trivial (mapping rows -> localStorage keys).
export function tulisKeLocal(rows) {
  terapkanDariCloud(pertahankanPosisiMurotal(rows));
}

async function pullSekali() {
  const rows = await cloudGetAll();
  tulisKeLocal(rows);
}

async function sinkronkanLaluTarik(onUpdate) {
  await cobaUlangPengaturanTertunda();
  await pullSekali();
  if (onUpdate) onUpdate();
}

// onUpdate: dipanggil tiap kali localStorage baru saja dimutakhirkan (pull
// awal, realtime, polling) - dipakai kiosk.js buat hal yang cuma dibaca
// SEKALI saat boot (mis. atribut data-versi tema, dikunci di inline script
// <head> sebelum modul ini jalan) supaya ikut update tanpa perlu reload
// manual begitu sync selesai/berubah.
export async function mulaiCloudSync(onUpdate) {
  if (!cloudAktif()) return;
  const notify = () => { if (onUpdate) onUpdate(); };

  cloudSubscribe(
    () => sinkronkanLaluTarik(notify),
    () => sinkronkanLaluTarik(notify),
  );

  // Muat data saat startup; Realtime mengisi ulang ketika Broadcast diterima
  // atau channel tersambung kembali. Tidak ada polling berkala.
  await Promise.race([sinkronkanLaluTarik(notify), new Promise((resolve) => setTimeout(resolve, 3000))]);
}
