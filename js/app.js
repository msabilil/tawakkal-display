import { SHOLAT } from "./config.js";

export function parseHM(hhmm, baseDate) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function nextSholat(now, jadwal) {
  for (const { key, label } of SHOLAT) {
    const t = parseHM(jadwal[key], now);
    if (t > now) return { key, label, time: t };
  }
  // semua lewat -> Subuh besok
  const besok = new Date(now);
  besok.setDate(besok.getDate() + 1);
  const subuh = SHOLAT[0];
  return { key: subuh.key, label: subuh.label, time: parseHM(jadwal[subuh.key], besok) };
}

export function iqomahState(now, jadwal, iqomahSettings) {
  for (const { key, label } of SHOLAT) {
    if (now.getDay() === 5 && key === "dzuhur") continue; // Jumat: dzuhur dilewati
    const set = iqomahSettings[key];
    if (!set || !set.aktif || set.menit <= 0) continue;
    const start = parseHM(jadwal[key], now);
    const end = new Date(start.getTime() + set.menit * 60000);
    if (now >= start && now < end) {
      const totalDetik = set.menit * 60;
      const sisaDetik = Math.ceil((end - now) / 1000);
      return { key, label, sisaDetik, totalDetik };
    }
  }
  return null;
}
