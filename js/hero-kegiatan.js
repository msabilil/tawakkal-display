import { entriAktif } from "./jadwal-pengajian.js";

const formatterTanggal = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function kegiatanTerdekat(now, entries) {
  const kegiatan = entriAktif(now, entries).find((entry) => entry._waktu >= now);
  if (!kegiatan) return null;

  return {
    nama: kegiatan.nama,
    tanggal: formatterTanggal.format(kegiatan._waktu),
    jam: kegiatan._jam ? `${kegiatan._jam} WIB` : "",
    pengisi: kegiatan._pengisi || "",
  };
}
