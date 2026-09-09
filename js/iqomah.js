import { mainkanNada } from "./nada.js";
import { terapkanBgLayar } from "./bg-layar.js";
import { tampilkan } from "./navigasi.js";
import { readCache } from "./api.js";
import { nextSholat } from "./app.js";

const KEY = "iqomahAktif";

const elJudul = document.getElementById("iqomah-judul");
const elAdzanLabel = document.getElementById("iqomah-adzan-label");
const elWaktu = document.getElementById("iqomah-waktu");

function pad(n) { return String(n).padStart(2, "0"); }

function fmtMenitDetik(totalDetik) {
  const m = Math.floor(totalDetik / 60);
  const d = totalDetik % 60;
  return `${pad(m)}:${pad(d)}`;
}

function bacaState() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function render(fase, label, sisaDetik) {
  document.body.classList.toggle("fase-adzan", fase === "adzan");
  document.body.classList.toggle("fase-iqomah", fase === "iqomah");
  elJudul.textContent = fase === "adzan" ? `Waktu ${label} Telah Masuk` : `Iqomah ${label}`;
  elAdzanLabel.textContent = `Adzan ${label}`;
  elWaktu.textContent = fmtMenitDetik(Math.max(sisaDetik, 0));
  terapkanBgLayar(fase, document.body);
}

function tick() {
  const data = bacaState();
  if (!data || !data.adzanEndTime || !data.iqomahEndTime) {
    tampilkan("sholat");
    return;
  }
  const now = new Date();
  const adzanEnd = new Date(data.adzanEndTime);
  const iqomahEnd = new Date(data.iqomahEndTime);
  if (now >= iqomahEnd) {
    localStorage.removeItem(KEY);
    tampilkan("sholat");
    return;
  }
  const faseAdzan = now < adzanEnd;
  const sisaDetik = Math.ceil(((faseAdzan ? adzanEnd : iqomahEnd) - now) / 1000);
  render(faseAdzan ? "adzan" : "iqomah", data.label, sisaDetik);
}

function mulaiCountdown() {
  mainkanNada(document.getElementById("audio-nada"));
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

// Dipanggil router (navigasi.js) tiap masuk view "iqomah".
export function start(opsi) {
  if (opsi.preview) {
    // Simulasikan lewat alur tick() asli (hitung mundur + nada beneran jalan)
    // pakai durasi singkat khusus preview, bukan cuma angka statis sekali render.
    // Nama sholat ikut jadwal asli (sholat berikutnya) - bukan "Dzuhur" tetap,
    // biar Demo Layar tidak kelihatan statis tiap dilihat.
    const fase = opsi.fase === "adzan" ? "adzan" : "iqomah";
    const now = Date.now();
    const cache = readCache();
    const sholat = cache && cache.jadwal ? nextSholat(new Date(now), cache.jadwal) : { key: "dzuhur", label: "Dzuhur" };
    const adzanDetik = fase === "adzan" ? 8 : 0;
    const adzanEndTime = new Date(now + adzanDetik * 1000).toISOString();
    const iqomahEndTime = new Date(now + (adzanDetik + 12) * 1000).toISOString();
    localStorage.setItem(KEY, JSON.stringify({ key: sholat.key, label: sholat.label, adzanEndTime, iqomahEndTime }));
    const stop = mulaiCountdown();
    return () => { stop(); localStorage.removeItem(KEY); };
  }
  return mulaiCountdown();
}
