const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
};

const { simpanMedia, cobaUlangPembersihanMedia } = await import("./kelola-media.js");
const hasilRollback = await simpanMedia({
  file: {}, nama: "baru.jpg", buatMetadata: () => ({ url: "baru" }),
  simpanMetadata: async () => ({ lokal: false, cloud: { ok: false } }),
  unggah: async () => "baru", hapus: async () => true,
});
if (hasilRollback.ok || hasilRollback.tahap !== "metadata") throw new Error("metadata gagal harus merollback upload baru");

let hapusLama = 0;
const hasilGanti = await simpanMedia({
  file: {}, nama: "baru.jpg", mediaLama: "lama",
  buatMetadata: (url) => ({ url }), simpanMetadata: async () => ({ lokal: true, cloud: { ok: false } }),
  unggah: async () => "baru", hapus: async () => { hapusLama++; return false; },
});
if (!hasilGanti.ok || !hasilGanti.pembersihanTertunda || hapusLama !== 1) throw new Error("hapus lama gagal harus diantrikan");

let retry = 0;
await cobaUlangPembersihanMedia({ hapus: async () => { retry++; return true; } });
if (retry !== 1 || localStorage.getItem("pembersihanMediaTertunda") !== null) throw new Error("retry sukses harus mengosongkan antrean");
console.log("3 PASS, 0 FAIL");
