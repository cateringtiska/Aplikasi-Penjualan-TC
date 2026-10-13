/* ==========================================================================
   SKALA CETAK DOKUMEN

   Quotation dan invoice katering kadang hanya lebih panjang sedikit dari
   satu halaman A4 — satu atau dua baris menu, atau blok syarat pembayaran
   yang mendorongnya lewat. Yang tercetak lalu dua lembar, dan lembar
   keduanya hampir kosong.

   Dialog cetak browser memang punya pengatur skala, tetapi letaknya
   berbeda-beda di tiap browser, berubah setiap kali dialognya dibuka, dan
   tidak ada hubungannya dengan dokumen yang sedang dilihat. Jadi pilihannya
   ditaruh di halaman cetaknya sendiri, dan hasilnya langsung terlihat
   sebelum dialog cetak dibuka.
   ========================================================================== */

/**
 * Skala paling kecil yang masih boleh dipakai.
 *
 * Di bawah ini hurufnya sudah terlalu kecil untuk dibaca orang yang
 * menerima dokumennya, dan dokumen yang tidak terbaca lebih buruk daripada
 * dokumen dua lembar. Yang tidak muat pada batas ini memang seharusnya dua
 * lembar.
 */
export const SKALA_MINIMUM = 0.5;

/**
 * Skala supaya isi dokumen muat pada satu halaman.
 *
 * Keduanya dalam satuan yang sama — piksel yang diukur browser sendiri,
 * bukan milimeter yang ditebak. Mengembalikan 1 kalau sudah muat: dokumen
 * yang pas satu halaman tidak perlu diperkecil, dan MEMBESARKANNYA justru
 * akan mendorongnya menjadi dua.
 */
export function hitungSkalaMuat(tinggiIsi: number, tinggiHalaman: number): number {
  if (!Number.isFinite(tinggiIsi) || !Number.isFinite(tinggiHalaman)) return 1;
  if (tinggiIsi <= 0 || tinggiHalaman <= 0) return 1;
  if (tinggiIsi <= tinggiHalaman) return 1;

  // Disisakan satu persen. Pembulatan piksel browser bisa membuat dokumen
  // yang dihitung "pas" tetap tumpah satu baris ke halaman berikutnya, dan
  // satu baris di lembar kedua adalah persis keadaan yang hendak dihindari.
  const pas = (tinggiHalaman / tinggiIsi) * 0.99;

  // Dibulatkan ke bawah per satu persen, supaya angkanya bisa disebutkan
  // apa adanya kepada pemakainya.
  const bulat = Math.floor(pas * 100) / 100;

  return Math.max(SKALA_MINIMUM, Math.min(1, bulat));
}

/** Pilihan skala yang ditawarkan, selain hitungan otomatisnya. */
export const PILIHAN_SKALA = [1, 0.9, 0.8, 0.7, 0.6] as const;

/** "86%" — dipakai menyebutkan skala yang sedang berlaku. */
export function labelSkala(skala: number): string {
  return `${Math.round(skala * 100)}%`;
}
