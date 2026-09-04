// Helper waktu murni yang dipakai bersama oleh app.js, murotal.js, dan
// jadwal-pengajian.js. Dipisah agar tidak ada circular import.
export function parseHM(hhmm, baseDate) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}
