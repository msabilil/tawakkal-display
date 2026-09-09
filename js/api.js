import { ID_KOTA } from "./config.js";

const CACHE_KEY = "jadwalCache";

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

export async function getJadwal(date) {
  const dk = dateKey(date);
  const [y, m, d] = dk.split("-");
  const url = `https://api.myquran.com/v2/sholat/jadwal/${ID_KOTA}/${y}/${m}/${d}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.status || !body.data || !body.data.jadwal) {
      throw new Error("Bentuk data API tidak sesuai");
    }
    const j = body.data.jadwal;
    const jadwal = {
      imsak: j.imsak, subuh: j.subuh, terbit: j.terbit, dzuhur: j.dzuhur,
      ashar: j.ashar, maghrib: j.maghrib, isya: j.isya,
    };
    const fetchedAt = new Date().toISOString();
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      dateKey: dk, jadwal, tanggalStr: j.tanggal, fetchedAt,
    }));
    return { jadwal, tanggalStr: j.tanggal, fromCache: false, fetchedAt };
  } catch (err) {
    const cache = readCache();
    if (cache && cache.jadwal) {
      return {
        jadwal: cache.jadwal, tanggalStr: cache.tanggalStr,
        fromCache: true, fetchedAt: cache.fetchedAt,
      };
    }
    throw new Error("Gagal fetch dan tidak ada cache: " + err.message);
  }
}
