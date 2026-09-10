import { redirect } from "next/navigation";

import { KerangkaAplikasi } from "@/components/kerangka-aplikasi";
import { sesiSekarang } from "@/lib/auth";

import { aksiKeluar } from "../aksi-sesi";

/**
 * Semua halaman di dalam kelompok (aplikasi) wajib login.
 *
 * Pemeriksaan dilakukan di sini, di server, sebelum satu piksel pun dikirim —
 * bukan di browser. Halaman yang butuh peran tertentu memeriksa lagi di
 * berkasnya masing-masing; menyembunyikan menu saja tidak pernah cukup.
 */
export default async function LayoutAplikasi({ children }: LayoutProps<"/">) {
  const sesi = await sesiSekarang();

  if (!sesi) {
    redirect("/masuk");
  }

  return (
    <KerangkaAplikasi sesi={sesi} onKeluar={aksiKeluar}>
      {children}
    </KerangkaAplikasi>
  );
}
