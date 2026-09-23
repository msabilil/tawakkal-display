import { mainkanNada } from "./nada.js";
import { terapkanBgLayar } from "./bg-layar.js";
import { tampilkan, elLayar } from "./navigasi.js";
import { readCache } from "./api.js";
import { nextSholat } from "./app.js";
import { loadAdzan, loadIqomah, loadNada } from "./settings.js";
import { jadwalTerkoreksi } from "./jadwal-terkoreksi.js";
import { buatPratinjauIqomah } from "./alur-ibadah.js";

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

function render(fase, label, sisaDetik, pemberitahuanAwal = false) {
  elLayar.classList.toggle("fase-adzan", fase === "adzan");
  elLayar.classList.toggle("fase-iqomah", fase === "iqomah");
  elLayar.classList.toggle("pemberitahuan-awal", pemberitahuanAwal);
  elJudul.textContent = fase === "adzan"
    ? (pemberitahuanAwal ? `Adzan ${label} Akan Segera Dimulai` : `Waktu ${label} Telah Masuk`)
    : `Iqomah ${label}`;
  elAdzanLabel.textContent = `Adzan ${label}`;
  // Selama 10 detik pemberitahuan awal countdown tetap terlihat pada nilai
  // durasi Adzan dan berkedip. Nilai baru mulai berkurang tepat saat jadwal
  // Adzan masuk.
  elWaktu.hidden = false;
  elWaktu.textContent = fmtMenitDetik(Math.max(sisaDetik, 0));
  terapkanBgLayar(fase, elLayar);
}

function tick() {
  const data = bacaState();
  if (!data || !data.adzanEndTime || !data.iqomahEndTime) {
    return;
  }
  const now = new Date();
  const adzanEnd = new Date(data.adzanEndTime);
  const iqomahEnd = new Date(data.iqomahEndTime);
  if (now >= iqomahEnd) {
    return;
  }
  const faseAdzan = now < adzanEnd;
  // Pada 10 detik pemberitahuan awal, layar dan nada sudah aktif tetapi
  // hitung mundur baru ditampilkan tepat ketika waktu Adzan masuk.
  const adzanMulai = data.adzanStartTime ? new Date(data.adzanStartTime) : null;
  const hitungMundurDimulai = !adzanMulai || now >= adzanMulai;
  const pemberitahuanAwal = faseAdzan && !hitungMundurDimulai;
  const sisaDetik = pemberitahuanAwal
    ? Math.ceil((adzanEnd - adzanMulai) / 1000)
    : Math.ceil(((faseAdzan ? adzanEnd : iqomahEnd) - now) / 1000);
  render(faseAdzan ? "adzan" : "iqomah", data.label, sisaDetik, pemberitahuanAwal);
  // Nada dipicu ketika fase Adzan mulai (10 detik sebelum jadwal), bukan
  // setelah durasi layar Adzan habis. Ini juga membuat alur Jumat berbunyi
  // sebelum slide khutbah dimulai. Flag disimpan di state agar refresh tidak
  // mengulang nada.
  if (!data.nadaDimainkan && (faseAdzan || data.putarNadaSaatMulai)) {
    localStorage.setItem(KEY, JSON.stringify({ ...data, nadaDimainkan: true }));
    const nada = loadNada();
    mainkanNada(document.getElementById("audio-nada"), { durasiDetik: nada.iqomahDetik });
  }
}

function mulaiCountdown() {
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
    const sholat = cache && cache.jadwal ? nextSholat(new Date(now), jadwalTerkoreksi(cache.jadwal)) : { key: "dzuhur", label: "Dzuhur" };
    const iqSet = loadIqomah()[sholat.key] || {};
    const iqomahDetik = iqSet.aktif && iqSet.menit > 0 ? iqSet.menit * 60 : 0;
    const keputusan = buatPratinjauIqomah({
      sekarang: new Date(now),
      fase,
      key: sholat.key,
      label: sholat.label,
      adzanMenit: loadAdzan().menit,
      iqomahMenit: iqomahDetik / 60,
    });
    localStorage.setItem(KEY, JSON.stringify({
      ...keputusan.state,
      nadaDimainkan: false,
    }));
    const stop = mulaiCountdown();
    return () => { stop(); localStorage.removeItem(KEY); };
  }
  return mulaiCountdown();
}
