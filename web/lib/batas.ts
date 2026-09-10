/* ==========================================================================
   BATAS PANJANG TEKS

   Kolom-kolom ini bertipe `text` di PostgreSQL, yang tidak punya batas
   panjang sama sekali. Angka di bawah karena itu bukan batas teknis — hanya
   penjaga supaya isian yang jelas keliru (misalnya seluruh berkas ter-paste
   ke satu kotak) tidak lolos begitu saja.

   Angkanya dinaikkan setelah syarat & ketentuan TISKA Catering — sepuluh
   bagian, dari standar servis buffet sampai ketentuan force majeure —
   ditolak oleh batas lama yang cuma 5.000 karakter. Dokumen semacam itu
   memang panjang, dan memang seharusnya bisa disimpan utuh.
   ========================================================================== */

/** Syarat & ketentuan: dokumen berhalaman-halaman masih wajar di sini. */
export const BATAS_SYARAT = 60_000;

/** Catatan pada penawaran atau tagihan: beberapa paragraf. */
export const BATAS_CATATAN = 10_000;

/** Keterangan pendek: alamat, deskripsi produk, catatan biaya. */
export const BATAS_KETERANGAN = 5_000;
