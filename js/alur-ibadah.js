import { ADZAN_LEBIH_AWAL_DETIK, SHOLAT } from "./config.js";
import { dayWIB, parseHM } from "./waktu.js";

// Nada hanya boleh dipicu oleh perpindahan fase yang dilihat aplikasi setelah
// sinkronisasi awal. Saat display baru dibuka di tengah fase, layarnya tetap
// ditampilkan tetapi tanpa memutar ulang nada pemberitahuan.
export function bolehPutarNadaPadaTransisi(sudahSinkronAwal) {
  return sudahSinkronAwal;
}

const DURASI_HIMBAUAN_SHOLAT_MODE_MS = 10_000;

export function himbauanSholatModeMasihTampil(mulai, sekarang) {
  const mulaiMs = new Date(mulai).getTime();
  const sekarangMs = new Date(sekarang).getTime();
  return Number.isFinite(mulaiMs) && Number.isFinite(sekarangMs)
    && sekarangMs >= mulaiMs && sekarangMs < mulaiMs + DURASI_HIMBAUAN_SHOLAT_MODE_MS;
}

function waktuIqomah(now, jadwal, iqomah, adzanMenit) {
  for (const { key, label } of SHOLAT) {
    if (dayWIB(now) === 5 && key === "dzuhur") continue;
    const pengaturan = iqomah[key] || {};
    const menitIqomah = pengaturan.aktif && pengaturan.menit > 0 ? pengaturan.menit : 0;
    if (adzanMenit + menitIqomah <= 0) continue;
    const mulai = parseHM(jadwal[key], now);
    const adzanMulai = new Date(mulai.getTime() - ADZAN_LEBIH_AWAL_DETIK * 1000);
    const adzanSelesai = new Date(mulai.getTime() + adzanMenit * 60000);
    const selesai = new Date(adzanSelesai.getTime() + menitIqomah * 60000);
    if (now < adzanMulai || now >= selesai) continue;
    return {
      view: "iqomah",
      state: {
        key,
        label,
        fase: now < adzanSelesai ? "adzan" : "iqomah",
        adzanStartTime: mulai.toISOString(),
        adzanEndTime: adzanSelesai.toISOString(),
        iqomahEndTime: selesai.toISOString(),
        putarNadaSaatMulai: adzanMenit === 0,
      },
    };
  }
  return null;
}

function waktuHening(now, jadwal, iqomah, hening, adzanMenit) {
  for (const { key } of SHOLAT) {
    if (dayWIB(now) === 5 && key === "dzuhur") continue;
    const pengaturan = hening[key] || {};
    if (!pengaturan.aktif || !(pengaturan.menit > 0)) continue;
    const iqomahSaatIni = iqomah[key] || {};
    const menitIqomah = iqomahSaatIni.aktif && iqomahSaatIni.menit > 0 ? iqomahSaatIni.menit : 0;
    const mulai = parseHM(jadwal[key], now);
    const heningMulai = new Date(mulai.getTime() + (adzanMenit + menitIqomah) * 60000);
    const selesai = new Date(heningMulai.getTime() + pengaturan.menit * 60000);
    if (now >= heningMulai && now < selesai) {
      return { view: "hening", state: { startTime: heningMulai.toISOString(), endTime: selesai.toISOString(), putarNada: true } };
    }
  }
  return null;
}

function alurJumat(now, jadwal, hening, adzanMenit, jumat) {
  if (dayWIB(now) !== 5) return null;
  const mulai = parseHM(jadwal.dzuhur, now);
  const adzanMulai = new Date(mulai.getTime() - ADZAN_LEBIH_AWAL_DETIK * 1000);
  const adzanSelesai = new Date(mulai.getTime() + adzanMenit * 60000);
  const slideSelesai = new Date(adzanSelesai.getTime() + jumat.durasiMenit * 60000);
  const menitHening = Math.max(0, hening.dzuhur?.menit || 0);
  const selesai = new Date(slideSelesai.getTime() + (jumat.sholatModeAktif ? menitHening * 60000 : 0));
  if (now < adzanMulai || now >= selesai) return null;
  if (now < adzanSelesai) {
    return {
      view: "iqomah",
      state: {
        key: "jumat",
        label: "Dzuhur",
        fase: "adzan",
        adzanStartTime: mulai.toISOString(),
        adzanEndTime: adzanSelesai.toISOString(),
        iqomahEndTime: adzanSelesai.toISOString(),
        putarNadaSaatMulai: false,
      },
    };
  }
  if (now < slideSelesai) {
    return {
      view: "jumat",
      state: {
        slideEndTime: slideSelesai.toISOString(),
        sholatModeAktif: !!jumat.sholatModeAktif,
        endTime: selesai.toISOString(),
        putarNada: false,
      },
    };
  }
  return { view: "hening", state: { startTime: slideSelesai.toISOString(), endTime: selesai.toISOString(), putarNada: false } };
}

export function buatPratinjauIqomah({ sekarang, fase, key, label, adzanMenit, iqomahMenit }) {
  const durasiAdzan = fase === "adzan" ? adzanMenit : 0;
  const adzanSelesai = new Date(sekarang.getTime() + durasiAdzan * 60000);
  const selesai = new Date(adzanSelesai.getTime() + iqomahMenit * 60000);
  return {
    view: "iqomah",
    state: {
      key,
      label,
      fase,
      adzanStartTime: sekarang.toISOString(),
      adzanEndTime: adzanSelesai.toISOString(),
      iqomahEndTime: selesai.toISOString(),
      putarNadaSaatMulai: true,
    },
  };
}

export function buatPratinjauJumat({ sekarang, durasiMenit, heningMenit, sholatModeAktif }) {
  const slideSelesai = new Date(sekarang.getTime() + durasiMenit * 60000);
  const selesai = new Date(slideSelesai.getTime() + (sholatModeAktif ? heningMenit * 60000 : 0));
  return {
    view: "jumat",
    state: {
      slideEndTime: slideSelesai.toISOString(),
      sholatModeAktif: !!sholatModeAktif,
      endTime: selesai.toISOString(),
      putarNada: false,
    },
  };
}

export function tentukanAlur({ now, jadwal, iqomah, hening, adzanMenit, jumat, tarawih }) {
  return alurJumat(now, jadwal, hening, adzanMenit, jumat)
    || waktuIqomah(now, jadwal, iqomah, adzanMenit)
    || tarawih
    || waktuHening(now, jadwal, iqomah, hening, adzanMenit)
    || null;
}
