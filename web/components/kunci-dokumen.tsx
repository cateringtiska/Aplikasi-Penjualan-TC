import { Lock } from "lucide-react";

/**
 * Keterangan kenapa satu dokumen tidak bisa diubah lagi.
 *
 * Tombol "Ubah" dulu hanya DIHILANGKAN ketika dokumennya terkunci, dan
 * halamannya tidak menyebut apa pun. Yang membukanya hanya menemukan tombol
 * yang kemarin ada sekarang tidak ada — terbaca sebagai aplikasi yang rusak,
 * bukan sebagai aturan yang memang disengaja. Mengetik alamat /ubah secara
 * langsung pun hanya memantul kembali tanpa pesan.
 *
 * Jadi penguncian apa pun harus menjelaskan DIRINYA SENDIRI, lengkap dengan
 * jalan keluarnya kalau memang ada. Penolakan tanpa jalan keluar adalah
 * sebab orang menyerah dan mencatat angkanya di tempat lain.
 */
export function KunciDokumen({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-6 flex items-start gap-2.5 rounded-md border bg-muted/40 px-3.5 py-3 text-sm">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
