import { KerangkaAplikasi } from "@/components/kerangka-aplikasi";
import { bacaIzin } from "@/lib/izin";
import { menuUntukIzin } from "@/lib/navigasi";
import { wajibSesi } from "@/lib/rbac";

import { aksiKeluar } from "../aksi-sesi";

/**
 * Semua halaman di dalam kelompok (aplikasi) wajib login.
 *
 * Pemeriksaan dilakukan di sini, di server, sebelum satu piksel pun dikirim —
 * bukan di browser. Halaman yang butuh peran tertentu memeriksa lagi di
 * berkasnya masing-masing; menyembunyikan menu saja tidak pernah cukup.
 */
export default async function LayoutAplikasi({ children }: LayoutProps<"/">) {
  const sesi = await wajibSesi();

  // Menu dan penjaga halaman membaca peta izin yang sama. bacaIzin() ditahan
  // selama satu permintaan, jadi keduanya pasti melihat keadaan yang sama —
  // menu yang menampilkan halaman yang ternyata ditolak adalah cara paling
  // membingungkan untuk memberitahu orang bahwa ia tidak punya akses.
  const kelompok = menuUntukIzin(sesi.peran, await bacaIzin());

  return (
    <KerangkaAplikasi sesi={sesi} kelompok={kelompok} onKeluar={aksiKeluar}>
      {children}
    </KerangkaAplikasi>
  );
}
