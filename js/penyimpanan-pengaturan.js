import { cloudSet } from "./cloud.js";

const KEY_TERTUNDA = "pengaturanTertunda";
const antreanCloud = new Map();
const penyimpananAktif = new Set();

function antrekanCloud(key, aksi) {
  const sebelumnya = antreanCloud.get(key) || Promise.resolve();
  const sekarang = sebelumnya.catch(() => {}).then(aksi);
  antreanCloud.set(key, sekarang);
  sekarang.finally(() => {
    if (antreanCloud.get(key) === sekarang) antreanCloud.delete(key);
  });
  return sekarang;
}

export function tungguSemuaPengaturan() {
  return Promise.all([...penyimpananAktif]);
}

function tulisJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function bacaTertunda() {
  try {
    return JSON.parse(localStorage.getItem(KEY_TERTUNDA)) || {};
  } catch {
    return {};
  }
}

function catatTertunda(key, value) {
  const tertunda = bacaTertunda();
  tertunda[key] = value;
  return tulisJson(KEY_TERTUNDA, tertunda);
}

function hapusTertunda(key) {
  const tertunda = bacaTertunda();
  if (!Object.hasOwn(tertunda, key)) return;
  delete tertunda[key];
  simpanTertunda(tertunda);
}

function simpanTertunda(tertunda) {
  try {
    if (Object.keys(tertunda).length) localStorage.setItem(KEY_TERTUNDA, JSON.stringify(tertunda));
    else localStorage.removeItem(KEY_TERTUNDA);
  } catch {
    return false;
  }
  return true;
}

export function simpanPengaturan(key, value, { sinkronkan = cloudSet, nilaiCloud = value } = {}) {
  const simpan = (async () => {
    const lokal = tulisJson(key, value);
    const cloud = await antrekanCloud(key, () => sinkronkan(key, nilaiCloud));
    const tertunda = lokal && !!cloud.active && !cloud.ok && catatTertunda(key, nilaiCloud);
    if (cloud.active && cloud.ok) hapusTertunda(key);
    return { lokal, cloud, tertunda };
  })();
  penyimpananAktif.add(simpan);
  simpan.finally(() => penyimpananAktif.delete(simpan));
  return simpan;
}

export function terapkanDariCloud(rows) {
  const tertunda = bacaTertunda();
  for (const row of rows) {
    if (!row || !row.key || Object.hasOwn(tertunda, row.key)) continue;
    tulisJson(row.key, row.value);
  }
}

export async function cobaUlangPengaturanTertunda({ sinkronkan = cloudSet } = {}) {
  const tertunda = bacaTertunda();
  const sisa = {};
  for (const [key, value] of Object.entries(tertunda)) {
    const cloud = await sinkronkan(key, value);
    if (!cloud.ok) sisa[key] = value;
  }
  simpanTertunda(sisa);
  return { tersinkron: Object.keys(tertunda).length - Object.keys(sisa).length, tertunda: Object.keys(sisa).length };
}
