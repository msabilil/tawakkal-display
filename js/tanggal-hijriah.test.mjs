import { formatTanggalHijriahWIB } from "./waktu.js";

const tanggal = new Date("2026-09-23T12:00:00+07:00");
const hasil = formatTanggalHijriahWIB(tanggal);

if (hasil !== "12 Rabiulakhir 1448 H") {
  throw new Error(`Tanggal Hijriah harus stabil lintas-browser. Diterima: ${hasil}`);
}

console.log("1 PASS, 0 FAIL");
