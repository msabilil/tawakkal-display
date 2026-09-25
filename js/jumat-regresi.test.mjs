import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { tentukanAlur, buatPratinjauJumat, himbauanSholatModeMasihTampil } from "./alur-ibadah.js";
import { formatJamWIB } from "./waktu.js";

const jadwal = { subuh: "04:34", dzuhur: "11:52", ashar: "15:09", maghrib: "17:56", isya: "19:01" };
const iqomah = Object.fromEntries(Object.keys(jadwal).map(key => [key, { aktif: true, menit: 10 }]));
const settings = { durasiMenit: 20, sholatModeAktif: true };
const keputusan = (waktu, jumat = settings, jadwalAktif = jadwal) => tentukanAlur({
  now: new Date(waktu), jadwal: jadwalAktif, iqomah, hening: iqomah, adzanMenit: 5, jumat, tarawih: null,
});
const zonaAwal = process.env.TZ;
try {
  for (const zona of ["Asia/Jakarta", "UTC", "America/Los_Angeles"]) {
    process.env.TZ = zona;
    if (zona === "America/Los_Angeles") assert.equal(new Date("2026-09-25T04:52:00Z").getDay(), 4);
    assert.equal(keputusan("2026-09-25T04:51:49Z"), null);
    assert.equal(keputusan("2026-09-25T04:51:50Z").state.key, "jumat");
    const adzan = keputusan("2026-09-25T04:52:00Z");
    assert.equal(adzan.state.fase, "adzan");
    assert.equal(adzan.state.iqomahEndTime, adzan.state.adzanEndTime);
    assert.equal(keputusan("2026-09-25T04:57:00Z").view, "jumat");
    assert.equal(keputusan("2026-09-25T05:16:59Z").view, "jumat");
    const hening = keputusan("2026-09-25T05:17:00Z");
    assert.equal(hening.view, "hening");
    assert.equal(hening.state.putarNada, false);
    assert.equal(keputusan("2026-09-25T05:27:00Z"), null);
    assert.equal(keputusan("2026-09-25T05:17:00Z", { ...settings, sholatModeAktif: false }), null);
    assert.equal(keputusan("2026-09-24T04:57:00Z").state.fase, "iqomah");
    assert.equal(keputusan("2026-09-25T04:52:00Z", settings, { ...jadwal, dzuhur: "11:57" }), null);
    assert.equal(keputusan("2026-09-25T05:02:00Z", settings, { ...jadwal, dzuhur: "11:57" }).view, "jumat");
    console.log(`PASS alur Jumat, batas fase, koreksi, dan hari biasa: ${zona}`);
  }
} finally {
  if (zonaAwal === undefined) delete process.env.TZ;
  else process.env.TZ = zonaAwal;
}

// Jalankan modul tampilan asli dengan DOM, jam, dan penyimpanan terisolasi.
async function tampilan({ slides = [], aktif = true } = {}) {
  let now = Date.parse("2026-09-25T04:57:00Z"), id = 0;
  const tasks = new Map(), navigasi = [], elements = new Map();
  const element = () => ({ hidden: false, textContent: "", innerHTML: "", children: [],
    querySelector() { return this.children.at(-1) || null; },
    appendChild(child) { this.children.push(child); }, remove() {}, classList: { add() {}, remove() {} } });
  const timer = (fn, delay, interval = false) => { tasks.set(++id, { fn, at: now + delay, delay, interval }); return id; };
  const data = new Map([["jumatAktif", JSON.stringify(buatPratinjauJumat({ sekarang: new Date(now), durasiMenit: 20, heningMenit: 10, sholatModeAktif: aktif }).state)]]);
  const context = vm.createContext({
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    document: { getElementById(name) { if (!elements.has(name)) elements.set(name, element()); return elements.get(name); }, createElement: element },
    localStorage: { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) },
    setTimeout: (fn, delay) => timer(fn, delay), setInterval: (fn, delay) => timer(fn, delay, true),
    clearTimeout: key => tasks.delete(key), clearInterval: key => tasks.delete(key), requestAnimationFrame: fn => fn(),
  });
  const imports = {
    "./jumat-mode.js": { loadJumatSlides: () => slides, loadJumatSettings: () => ({ ...settings, sholatModeAktif: aktif }) },
    "./settings.js": { loadHening: () => iqomah, loadNada: () => ({}) },
    "./navigasi.js": { tampilkan: (...args) => navigasi.push(args) },
    "./alur-ibadah.js": { buatPratinjauJumat, himbauanSholatModeMasihTampil },
    "./waktu.js": { formatJamWIB },
    "./nada.js": { mainkanNada: () => assert.fail("Pratinjau tidak boleh memutar nada") },
  };
  async function load(file) {
    const mod = new vm.SourceTextModule(await readFile(new URL(file, import.meta.url), "utf8"), { context });
    await mod.link(specifier => {
      const exports = imports[specifier];
      assert.ok(exports, `Import tidak diizinkan: ${specifier}`);
      return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context });
    });
    await mod.evaluate();
    return mod.namespace;
  }
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [key, task] = next;
      now = task.at;
      if (task.interval) task.at += task.delay;
      else tasks.delete(key);
      task.fn();
    }
    now = end;
  }
  return { module: await load("./jumat.js"), load, elements, tasks, navigasi, advance };
}

for (const slides of [[], [{ tipe: "gambar", urlCloud: "fixture.jpg", durasiDetik: 1200 }]]) {
  const f = await tampilan({ slides });
  const stop = f.module.start({ preview: true });
  assert.equal(f.elements.get("jumat-kosong").hidden, slides.length > 0);
  if (!slides.length) assert.equal(f.elements.get("jumat-jam").textContent, "11:57 WIB");
  f.advance(20 * 60_000 - 1);
  assert.equal(f.navigasi.length, 0);
  f.advance(1);
  assert.equal(f.navigasi[0][0], "hening");
  stop();
  assert.equal(f.tasks.size, 0);
  const hening = await f.load("./hening.js");
  const stopHening = hening.start(f.navigasi[0][1]);
  assert.equal(f.elements.get("hening-himbauan").hidden, false);
  f.advance(10_000);
  assert.equal(f.elements.get("hening-himbauan").hidden, true);
  stopHening();
  console.log(`PASS pratinjau ${slides.length ? "slide" : "kosong"} -> Sholat Mode dan pembersihan timer`);
}
for (const opsi of [{ preview: true, aktif: false }, { preview: false, aktif: true }]) {
  const f = await tampilan({ aktif: opsi.aktif });
  const stop = f.module.start({ preview: opsi.preview });
  f.advance(20 * 60_000);
  assert.equal(f.navigasi.length, 0);
  stop();
  assert.equal(f.tasks.size, 0);
}
const dibatalkan = await tampilan();
dibatalkan.module.start({ preview: true })();
dibatalkan.advance(20 * 60_000);
assert.equal(dibatalkan.navigasi.length, 0);
console.log("PASS Sholat Mode nonaktif, kepemilikan alur normal, dan pembatalan pratinjau");
