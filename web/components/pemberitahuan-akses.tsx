/**
 * Pemberitahuan bahwa halaman yang dibuka memang ditutup untuk perannya.
 *
 * Tanpa ini, orang yang membuka halaman terlarang hanya mendapati dirinya
 * tiba-tiba berada di halaman lain — yang terbaca sebagai tautan rusak,
 * bukan sebagai penolakan yang disengaja.
 *
 * Dipasang di halaman yang bisa menjadi HALAMAN AWAL suatu peran, karena ke
 * situlah penolakan melemparkan orangnya (lihat halamanAwal di
 * lib/navigasi.ts). Dulu hanya dasbor yang memilikinya, dan peran yang
 * halaman awalnya bukan dasbor terlempar tanpa penjelasan apa pun.
 */
export function PemberitahuanAkses({ ditolak }: { ditolak: boolean }) {
  if (!ditolak) return null;

  return (
    <p
      role="alert"
      className="mt-6 rounded-md border border-border-strong/60 bg-muted/50 px-3.5 py-3 text-sm"
    >
      Halaman yang Anda buka hanya untuk peran tertentu, jadi Anda dikembalikan ke halaman
      awal Anda. Ini bukan kesalahan — menu yang tidak terlihat memang sengaja ditutup untuk
      peran Anda.
    </p>
  );
}
