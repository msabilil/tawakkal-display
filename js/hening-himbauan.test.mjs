import { himbauanSholatModeMasihTampil } from "./alur-ibadah.js";

const mulai = new Date("2026-09-23T12:00:00.000Z");

if (!himbauanSholatModeMasihTampil(mulai, new Date("2026-09-23T12:00:09.999Z"))) {
  throw new Error("Himbauan harus tampil selama sepuluh detik pertama.");
}
if (himbauanSholatModeMasihTampil(mulai, new Date("2026-09-23T12:00:10.000Z"))) {
  throw new Error("Himbauan harus hilang tepat setelah sepuluh detik.");
}

console.log("2 PASS, 0 FAIL");
