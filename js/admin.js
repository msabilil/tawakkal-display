import { SHOLAT } from "./config.js";
import { loadIqomah, saveIqomah } from "./settings.js";

const $ = (id) => document.getElementById(id);

function render() {
  const settings = loadIqomah();
  const wrap = $("baris-sholat");
  wrap.innerHTML = "";
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

function simpan(e) {
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
  const status = $("status-simpan");
  status.hidden = false;
  setTimeout(() => { status.hidden = true; }, 2000);
}

render();
$("form-iqomah").addEventListener("submit", simpan);
