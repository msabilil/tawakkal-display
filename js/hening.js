// Layar hitam polos - dipicu app.js (pasca-iqomah atau tarawih), lihat
// heningState()/tarawihState(). endTime disimpan di localStorage biar tahan
// refresh (kartu ini murni baca state, tidak hitung apa-apa sendiri).
import { tampilkan } from "./navigasi.js";
import { mainkanNada } from "./nada.js";
import { loadNada } from "./settings.js";

const KEY = "heningAktif";

export function mulaiHening(endTimeIso, { putarNada = true } = {}) {
  localStorage.setItem(KEY, JSON.stringify({ endTime: endTimeIso, putarNada }));
  tampilkan("hening");
}

function bacaState() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && data.endTime ? { ...data, endTime: new Date(data.endTime) } : null;
  } catch {
    return null;
  }
}

// Dipanggil router (navigasi.js) tiap masuk view "hening".
export function start(opsi) {
  const state = bacaState();
  if (state?.putarNada !== false) {
    const nada = loadNada();
    mainkanNada(document.getElementById("audio-nada"), {
      mediaKey: "nadaSholatMode",
      durasiDetik: nada.sholatModeDetik,
    });
  }
  if (opsi.preview) return; // preview dibuka manual oleh admin

  const sisaMs = state ? state.endTime - Date.now() : 0;
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
