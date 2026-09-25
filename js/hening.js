// Layar Sholat Mode - dipicu app.js (pasca-iqomah atau tarawih), lihat
// heningState()/tarawihState(). Waktu mulai dan akhir disimpan agar
// himbauan awal tetap tepat sepuluh detik, termasuk sesudah halaman dimuat ulang.
import { tampilkan } from "./navigasi.js";
import { mainkanNada } from "./nada.js";
import { loadNada } from "./settings.js";
import { himbauanSholatModeMasihTampil } from "./alur-ibadah.js";

const KEY = "heningAktif";

export function mulaiHening(endTimeIso, { startTime, putarNada = true } = {}) {
  localStorage.setItem(KEY, JSON.stringify({ startTime, endTime: endTimeIso, nadaDimainkan: !putarNada }));
  tampilkan("hening");
}

function bacaState() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && data.endTime ? {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: new Date(data.endTime),
    } : null;
  } catch {
    return null;
  }
}

function tampilkanHimbauan(state) {
  const el = document.getElementById("hening-himbauan");
  if (!state?.startTime || !himbauanSholatModeMasihTampil(state.startTime, new Date())) {
    el.hidden = true;
    return () => {};
  }

  el.hidden = false;
  const sisa = Math.max(0, new Date(state.startTime).getTime() + 10_000 - Date.now());
  const id = setTimeout(() => { el.hidden = true; }, sisa);
  return () => clearTimeout(id);
}

// Dipanggil router (navigasi.js) tiap masuk view "hening".
export function start(opsi) {
  const state = opsi.preview && opsi.startTime
    ? { startTime: new Date(opsi.startTime) }
    : bacaState();
  const stopHimbauan = tampilkanHimbauan(state);
  if (!opsi.preview && state && !state.nadaDimainkan) {
    localStorage.setItem(KEY, JSON.stringify({
      ...state,
      startTime: state.startTime?.toISOString(),
      endTime: state.endTime.toISOString(),
      nadaDimainkan: true,
    }));
    const nada = loadNada();
    mainkanNada(document.getElementById("audio-nada"), {
      mediaKey: "nadaSholatMode",
      durasiDetik: nada.sholatModeDetik,
    });
  }
  // Tenggat dan perpindahan layar dimiliki Alur Layar Ibadah di app.js.
  // View ini hanya menampilkan fase yang sudah diputuskan.
  if (opsi.preview) return stopHimbauan;
  return stopHimbauan;
}
