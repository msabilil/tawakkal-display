import { ringkasJadwalSholat } from "./jadwal-terkoreksi.js";

const jadwal = ringkasJadwalSholat({
  imsak: "04:15",
  subuh: "04:25",
  terbit: "05:36",
  dzuhur: "11:48",
  ashar: "15:08",
  maghrib: "17:50",
  isya: "18:59",
});

const diharapkan = [
  { key: "subuh", label: "Subuh", jam: "04:25" },
  { key: "dzuhur", label: "Dzuhur", jam: "11:48" },
  { key: "ashar", label: "Ashar", jam: "15:08" },
  { key: "maghrib", label: "Maghrib", jam: "17:50" },
  { key: "isya", label: "Isya", jam: "18:59" },
];

if (JSON.stringify(jadwal) !== JSON.stringify(diharapkan)) {
  throw new Error(`Ringkasan QR tidak memuat lima waktu salat. Diterima: ${JSON.stringify(jadwal)}`);
}

console.log("1 PASS, 0 FAIL");
