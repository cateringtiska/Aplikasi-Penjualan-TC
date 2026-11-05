import { UserRound } from "lucide-react";

/**
 * Nama orang yang menginput dokumen, untuk baris di halaman daftar.
 * Hanya nama depannya yang tampil supaya barisnya tetap ringkas; nama
 * lengkapnya muncul saat kursor diarahkan.
 */
export function Penginput({ nama }: { nama: string | null | undefined }) {
  if (!nama) return null;
  const depan = nama.trim().split(/\s+/)[0];
  return (
    <span
      className="mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground"
      title={`Diinput oleh ${nama}`}
    >
      <UserRound className="size-3" aria-hidden="true" />
      <span className="sr-only">Diinput oleh </span>
      {depan}
      {/* Nama lengkap ikut ada di halaman supaya pencarian seketika di daftar
          juga menemukan nama belakangnya. */}
      <span className="sr-only">{nama}</span>
    </span>
  );
}
