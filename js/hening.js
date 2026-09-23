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
  // Tenggat dan perpindahan layar dimiliki Alur Layar Ibadah di app.js.
  // View ini hanya menampilkan fase yang sudah diputuskan.
  if (opsi.preview) return;
}
