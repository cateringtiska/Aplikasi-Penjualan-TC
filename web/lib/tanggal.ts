import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

/* ==========================================================================
   MERINGKAS TANGGAL ACARA

   Satu dokumen bisa menanggung acara beberapa hari, dan tanggalnya tidak
   selalu berurutan: 10, 12, lalu 15 Mei. Yang dicetak harus bisa dibaca
   sekali lihat oleh orang yang menerima dokumennya, tanpa menghitung sendiri.

   Tiga bentuk, dipilih dari tanggalnya sendiri:

     satu hari       10 Mei 2026
     berurutan       10 – 12 Mei 2026
     meloncat        10, 12 & 15 Mei 2026

   Bagian yang sama tidak diulang. "10, 12 & 15 Mei 2026" lebih mudah dibaca
   daripada "10 Mei 2026, 12 Mei 2026 & 15 Mei 2026", dan di dokumen yang
   kolomnya sempit perbedaan itu menentukan apakah tanggalnya muat satu baris.
   ========================================================================== */

const SEHARI = 24 * 60 * 60 * 1000;

/** Membuang jam, supaya dua tanggal yang sama tidak berbeda karena zonanya. */
function hari(t: Date): number {
  return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / SEHARI;
}

/** Mengurutkan, membuang yang kembar, dan membuang yang tidak sah. */
export function rapikanTanggal(daftar: Date[]): Date[] {
  const terlihat = new Set<number>();
  const bersih: Date[] = [];

  for (const t of daftar) {
    if (!(t instanceof Date) || Number.isNaN(t.getTime())) continue;
    const kunci = hari(t);
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    bersih.push(t);
  }

  return bersih.sort((a, b) => a.getTime() - b.getTime());
}

function berurutan(daftar: Date[]): boolean {
  for (let i = 1; i < daftar.length; i++) {
    if (hari(daftar[i]) - hari(daftar[i - 1]) !== 1) return false;
  }
  return true;
}

function samaBulan(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

const panjang = (t: Date) => format(t, "d MMMM yyyy", { locale: localeId });

/**
 * Menyusun daftar tanggal menjadi satu kalimat siap cetak.
 *
 * Mengembalikan null kalau tidak ada tanggalnya — pemanggil yang memutuskan
 * mau menulis "-" atau menyembunyikan barisnya.
 */
export function ringkasTanggalAcara(daftar: Date[]): string | null {
  const t = rapikanTanggal(daftar);
  if (t.length === 0) return null;
  if (t.length === 1) return panjang(t[0]);

  const awal = t[0];
  const akhir = t[t.length - 1];

  if (berurutan(t)) {
    // Bagian yang sama disebut sekali, di ujung kanan: "10 – 12 Mei 2026",
    // "30 April – 2 Mei 2026", "30 Desember 2026 – 1 Januari 2027".
    if (samaBulan(awal, akhir)) {
      return `${format(awal, "d", { locale: localeId })} – ${panjang(akhir)}`;
    }
    if (awal.getFullYear() === akhir.getFullYear()) {
      return `${format(awal, "d MMMM", { locale: localeId })} – ${panjang(akhir)}`;
    }
    return `${panjang(awal)} – ${panjang(akhir)}`;
  }

  // Meloncat. Kalau seluruhnya dalam satu bulan, cukup angka tanggalnya.
  const seragam = t.every((x) => samaBulan(x, awal));
  const bagian = seragam
    ? t.map((x, i) => (i === t.length - 1 ? panjang(x) : format(x, "d", { locale: localeId })))
    : t.map(panjang);

  return `${bagian.slice(0, -1).join(", ")} & ${bagian[bagian.length - 1]}`;
}

/** Jumlah hari acara = banyaknya tanggal, bukan selisih ujung ke ujung. */
export function jumlahHariAcara(daftar: Date[]): number {
  return rapikanTanggal(daftar).length;
}
