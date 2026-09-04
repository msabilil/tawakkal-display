import { SHOLAT, WAKTU_HARIAN } from "./config.js";
import { loadIqomah, saveIqomah } from "./settings.js";
import { loadOverride, saveOverride, clearOverride } from "./testing.js";
import { loadTampilan, saveTampilan } from "./tampilan.js";

const $ = (id) => document.getElementById(id);

function renderIqomah() {
  const settings = loadIqomah();
  const wrap = $("baris-sholat");
  wrap.innerHTML = "";
  $("admin-hint").hidden = true;
  for (const { key, label } of SHOLAT) {
    const s = settings[key];
    const row = document.createElement("div");
    row.className = "baris";
    row.innerHTML = `
      <span class="label-sholat">${label}</span>
      <input type="number" min="0" max="60" id="menit-${key}" value="${s.menit}">
      <label class="aktif-cek"><input type="checkbox" id="aktif-${key}" ${s.aktif ? "checked" : ""}> aktif</label>
    `;
    wrap.appendChild(row);
  }
}

function simpanIqomah(e) {
  e.preventDefault();
  const settings = {};
  for (const { key } of SHOLAT) {
    const menit = parseInt($(`menit-${key}`).value, 10);
    settings[key] = {
      menit: Number.isFinite(menit) && menit >= 0 ? menit : 0,
      aktif: $(`aktif-${key}`).checked,
    };
  }
  saveIqomah(settings);
  tampilkanStatus("status-simpan");
}

function renderTampilan() {
  const t = loadTampilan();
  $("tampilan-header").checked = t.header;
  $("tampilan-maklumat").checked = t.maklumat;
}

function simpanTampilan(e) {
  e.preventDefault();
  saveTampilan({
    header: $("tampilan-header").checked,
    maklumat: $("tampilan-maklumat").checked,
  });
  tampilkanStatus("status-tampilan");
}

function renderTesting() {
  const ov = loadOverride();
  $("testing-aktif").checked = ov.aktif;
  const wrap = $("baris-testing");
  wrap.innerHTML = "";
  for (const { key, label } of WAKTU_HARIAN) {
    const row = document.createElement("div");
    row.className = "baris baris-testing";
    row.innerHTML = `
      <span class="label-sholat">${label}</span>
      <input type="time" id="ov-${key}" value="${ov.jadwal[key] || ""}">
    `;
    wrap.appendChild(row);
  }
}

function simpanTesting(e) {
  e.preventDefault();
  const jadwal = {};
  for (const { key } of WAKTU_HARIAN) {
    jadwal[key] = $(`ov-${key}`).value || "";
  }
  saveOverride({ aktif: $("testing-aktif").checked, jadwal });
  tampilkanStatus("status-testing");
}

function resetTesting() {
  clearOverride();
  renderTesting();
  tampilkanStatus("status-testing");
}

function tampilkanStatus(id) {
  const el = $(id);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2000);
}

renderIqomah();
renderTampilan();
renderTesting();
$("form-iqomah").addEventListener("submit", simpanIqomah);
$("form-tampilan").addEventListener("submit", simpanTampilan);
$("form-testing").addEventListener("submit", simpanTesting);
$("tombol-reset-testing").addEventListener("click", resetTesting);
