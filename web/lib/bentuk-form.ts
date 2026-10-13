/* ==========================================================================
   BENTUK DATA FORMULIR DOKUMEN

   Berkas ini SENGAJA tidak memakai "use client" maupun "server-only".

   components/form-dokumen.tsx adalah modul klien. Di App Router, setiap
   ekspor modul klien berubah menjadi RUJUKAN ketika dibaca dari server —
   bukan fungsi yang sesungguhnya. Memanggilnya di halaman server melempar
   galat saat dijalankan, dan tidak ada yang bisa melihatnya lebih dulu:
   tipenya sama persis, `tsc` lolos, dan `next build` lolos.

   Itu pernah terjadi: halaman ubah invoice dan quotation memanggil
   tanggalKosong() dari modul klien, dan ketiganya berhenti dengan "A server
   error occurred" sampai pemiliknya melaporkannya.

   Jadi pembantu yang dipakai KEDUA SISI tinggal di sini, bukan di sana.
   Dikunci oleh app/impor-klien.test.ts.
   ========================================================================== */

/** Satu tanggal acara. Kuncinya supaya baris tidak berpindah saat dihapus. */
export type BarisTanggalForm = { kunci: string; tanggal: string };

export function tanggalKosong(tanggal = ""): BarisTanggalForm {
  return { kunci: crypto.randomUUID(), tanggal };
}

/**
 * Apakah isian <input type="date"> sudah layak dikirim ke alamat halaman.
 *
 * PENYARING LAPORAN TERKUNCI KARENA INI. Isiannya dikendalikan penuh oleh
 * alamat halaman, dan setiap ketikan langsung memindahkan alamatnya. Saat
 * seseorang mengetik tahun "2026" angka demi angka, browser melaporkan
 * nilainya sebagai "0002-09-30" begitu angka pertama masuk — halaman
 * berpindah, isiannya digambar ulang dari alamat yang baru, dan tahunnya
 * terkunci di 0002. Tiga angka sisanya tidak pernah sampai.
 *
 * Tidak ada galat apa pun yang muncul: laporannya tetap terbuka, hanya
 * menampilkan rentang tanggal yang mustahil, dan seluruh angkanya nol.
 *
 * Kosong tetap dianggap layak — itulah cara melepas penyaringnya.
 */
export function tanggalSiapDisaring(nilai: string): boolean {
  if (nilai === "") return true;

  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nilai);
  if (!cocok) return false;

  // Tahun empat angka yang masuk akal. Yang kurang dari seribu selalu
  // berarti tahunnya belum selesai diketik.
  const tahun = Number(cocok[1]);
  return tahun >= 1000 && tahun <= 9999;
}
