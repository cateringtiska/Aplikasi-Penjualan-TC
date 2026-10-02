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
