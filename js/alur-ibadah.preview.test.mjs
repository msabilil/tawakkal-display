import { buatPratinjauIqomah, buatPratinjauJumat } from "./alur-ibadah.js";

const sekarang = new Date("2026-09-23T12:00:00.000Z");
const adzan = buatPratinjauIqomah({ sekarang, fase: "adzan", key: "dzuhur", label: "Dzuhur", adzanMenit: 5, iqomahMenit: 10 });
if (adzan.view !== "iqomah" || adzan.state.fase !== "adzan" || adzan.state.iqomahEndTime !== "2026-09-23T12:15:00.000Z") throw new Error("preview adzan tidak memakai tenggat alur");

const iqomah = buatPratinjauIqomah({ sekarang, fase: "iqomah", key: "dzuhur", label: "Dzuhur", adzanMenit: 5, iqomahMenit: 10 });
if (iqomah.state.fase !== "iqomah" || iqomah.state.iqomahEndTime !== "2026-09-23T12:10:00.000Z") throw new Error("preview iqomah tidak memakai tenggat alur");

const jumat = buatPratinjauJumat({ sekarang, durasiMenit: 20, heningMenit: 10, sholatModeAktif: true });
if (jumat.view !== "jumat" || jumat.state.slideEndTime !== "2026-09-23T12:20:00.000Z" || jumat.state.endTime !== "2026-09-23T12:30:00.000Z") throw new Error("preview Jumat tidak memakai tenggat alur");
console.log("3 PASS, 0 FAIL");
