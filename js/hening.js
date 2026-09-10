// Layar hitam polos - dipicu app.js (pasca-iqomah atau tarawih), lihat
// heningState()/tarawihState(). endTime disimpan di localStorage biar tahan
// refresh (kartu ini murni baca state, tidak hitung apa-apa sendiri).
import { tampilkan } from "./navigasi.js";

const KEY = "heningAktif";

export function mulaiHening(endTimeIso) {
  localStorage.setItem(KEY, JSON.stringify({ endTime: endTimeIso }));
  tampilkan("hening");
}

function bacaEndTime() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && data.endTime ? new Date(data.endTime) : null;
  } catch {
    return null;
  }
}

// Dipanggil router (navigasi.js) tiap masuk view "hening".
export function start(opsi) {
  if (opsi.preview) return; // statis, admin tutup tab manual

  const endTime = bacaEndTime();
  const sisaMs = endTime ? endTime - Date.now() : 0;
  if (sisaMs <= 0) {
    localStorage.removeItem(KEY);
    tampilkan("sholat");
    return;
  }
  const id = setTimeout(() => {
    localStorage.removeItem(KEY);
    tampilkan("sholat");
  }, sisaMs);
  return () => clearTimeout(id);
}
