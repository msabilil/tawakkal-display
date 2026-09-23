import { ID_KOTA } from "./config.js";
import { dateKeyWIB } from "./waktu.js";

const CACHE_KEY = "jadwalCache";

export function dateKey(date) {
  return dateKeyWIB(date);
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
    // Jangan pernah memakai cache dari tanggal kemarin. Jadwal yang salah
    // lebih berbahaya daripada menampilkan status offline sampai koneksi pulih.
    if (cache && cache.dateKey === dk && cache.jadwal) {
      return {
        jadwal: cache.jadwal, tanggalStr: cache.tanggalStr,
        fromCache: true, fetchedAt: cache.fetchedAt,
      };
    }
    throw new Error("Gagal fetch dan tidak ada cache jadwal untuk hari ini: " + err.message);
  }
}
