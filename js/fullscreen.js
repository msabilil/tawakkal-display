// Tombol layar penuh - satu-satunya di index.html, dipakai lintas semua view.
const IKON_MAXIMIZE = `<path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" />`;
const IKON_MINIMIZE = `<path d="M15 19v-2a2 2 0 0 1 2 -2h2" /><path d="M15 5v2a2 2 0 0 0 2 2h2" /><path d="M5 15h2a2 2 0 0 1 2 2v2" /><path d="M5 9h2a2 2 0 0 0 2 -2v-2" />`;

export function setupFullscreen() {
  const btn = document.getElementById("tombol-fullscreen");
  if (!btn) return;
  if (window.self !== window.top) {
    // Di dalam iframe (Demo Layar, lihat demo.html) - iframe dikunci
    // allow="fullscreen 'none'" jadi tombol ini tidak akan pernah jalan, dan
    // tombol admin di grup yang sama bisa nyasar navigasi iframe ke
    // admin.html kalau tersentuh. demo.html sudah punya tombol fullscreen
    // sendiri di luar iframe - buang grup ini daripada nampilin yang mati.
    btn.closest(".tombol-grup-mengambang")?.remove();
    return;
  }
  const svg = btn.querySelector("svg");
  function sync() {
    const full = !!document.fullscreenElement;
    svg.innerHTML = full ? IKON_MINIMIZE : IKON_MAXIMIZE;
    btn.setAttribute("aria-label", full ? "Keluar layar penuh" : "Layar penuh");
  }
  btn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  document.addEventListener("fullscreenchange", sync);
  sync();

  // Dibuka dari admin (tombol "Simpan & Lihat Layar") - coba langsung layar
  // penuh. Browser boleh nolak (tab baru dianggap belum ada interaksi user),
  // diam saja kalau gagal - tombol di atas tetap ada buat coba manual.
  if (new URLSearchParams(location.search).get("fullscreen") === "1") {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}
