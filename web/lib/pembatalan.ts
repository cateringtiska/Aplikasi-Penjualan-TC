/* ==========================================================================
   ALASAN PEMBATALAN

   Dokumen yang dibatalkan tetap ada di daftar dan tetap terhitung di
   laporan, tetapi tanpa keterangan kenapa. Beberapa minggu kemudian tidak
   seorang pun bisa menjawabnya — apakah customer yang membatalkan, apakah
   salah terbit, atau apakah digantikan dokumen lain. Yang bertanya biasanya
   customer itu sendiri, atau akuntan saat menutup bulan.

   Aturannya ditaruh di sini, bukan di dalam server action, supaya bisa
   diuji sebagai satuan dan supaya invoice dan quotation tidak mungkin
   memakai aturan yang berbeda.
   ========================================================================== */

/**
 * Panjang terpendek yang diterima.
 *
 * Bukan sekadar "tidak kosong": satu huruf, titik, atau spasi lolos dari
 * pemeriksaan kosong tetapi tidak menjelaskan apa pun — dan isian yang bisa
 * dilewati dengan satu ketukan akan selalu dilewati.
 */
export const MIN_ALASAN = 5;

export const MAX_ALASAN = 500;

export type HasilAlasan =
  | { ok: true; alasan: string }
  | { ok: false; pesan: string };

export function bacaAlasanPembatalan(teks: string | null | undefined): HasilAlasan {
  // Spasi di ujung dibuang lebih dulu: "   " bukan alasan, dan tanpa ini ia
  // tersimpan sebagai alasan yang tampak terisi di database.
  const bersih = String(teks ?? "").trim().replace(/\s+/g, " ");

  if (bersih === "") {
    return { ok: false, pesan: "Alasan pembatalan belum diisi." };
  }

  if (bersih.length < MIN_ALASAN) {
    return {
      ok: false,
      pesan: `Alasan pembatalan terlalu pendek. Tulis sedikitnya ${MIN_ALASAN} huruf supaya masih bisa dimengerti beberapa bulan lagi.`,
    };
  }

  if (bersih.length > MAX_ALASAN) {
    return { ok: false, pesan: `Alasan pembatalan terlalu panjang, maksimal ${MAX_ALASAN} huruf.` };
  }

  return { ok: true, alasan: bersih };
}
