import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const tampilan = readFileSync(new URL("./iqomah.js", import.meta.url), "utf8");

if (!tampilan.includes('classList.toggle("pemberitahuan-awal", pemberitahuanAwal)')) {
  throw new Error("Status pemberitahuan awal belum diteruskan ke kelas layar.");
}

if (!css.includes("#layar-16x9.iqomah-page.fase-adzan.pemberitahuan-awal #iqomah-waktu:not([hidden])")) {
  throw new Error("Kedip belum dibatasi hanya untuk 10 detik pemberitahuan awal.");
}

if (css.includes("#layar-16x9.iqomah-page.fase-adzan #iqomah-waktu:not([hidden]) {\n  animation: adzan-countdown-kedip")) {
  throw new Error("Selector kedip lama masih berlaku untuk seluruh fase adzan.");
}

console.log("3 PASS, 0 FAIL");
