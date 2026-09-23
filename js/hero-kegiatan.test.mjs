import { strict as assert } from "node:assert";

let kegiatanTerdekat;
try {
  ({ kegiatanTerdekat } = await import("./hero-kegiatan.js"));
} catch {
  // Modul belum ada: assertion di bawah sengaja menjadi RED pertama.
}

const now = new Date("2026-09-23T12:00:00+07:00");
const entries = [
  { id: "lewat", tipe: "tanggal", tanggal: "2026-09-23", jam: "10:00", nama: "Kajian yang sudah lewat", pengisi: "Ust. Lama" },
  { id: "terdekat", tipe: "tanggal", tanggal: "2026-09-24", jam: "19:30", nama: "Kajian Tafsir", pengisi: "Ust. Ahmad" },
  { id: "setelahnya", tipe: "tanggal", tanggal: "2026-09-25", jam: "08:00", nama: "Kelas Tahsin", pengisi: "Ust. Budi" },
];

assert.deepEqual(
  kegiatanTerdekat?.(now, entries),
  {
    nama: "Kajian Tafsir",
    tanggal: "Kamis, 24 September 2026",
    jam: "19:30 WIB",
    pengisi: "Ust. Ahmad",
  },
  "kartu hero harus memilih kegiatan mendatang terdekat dan membawa pengisinya",
);

assert.equal(
  kegiatanTerdekat?.(now, []),
  null,
  "kartu hero harus kosong ketika tidak ada kegiatan mendatang",
);

console.log("2 PASS, 0 FAIL");
