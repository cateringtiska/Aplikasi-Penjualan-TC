import { SkalaCetak } from "@/components/skala-cetak";
import { TombolCetak } from "@/components/tombol-cetak";

/**
 * Kerangka halaman cetak — tanpa navigasi, tanpa sidebar.
 *
 * Dokumen dibuat sebagai halaman web yang ditata untuk kertas A4, lalu
 * disimpan menjadi PDF lewat dialog cetak browser. Cara ini dipilih daripada
 * membuat PDF di server karena tiga alasan praktis: hurufnya pasti benar
 * (termasuk rupiah dan huruf beraksen), tidak menambah pustaka berat yang
 * rapuh di lingkungan serverless, dan hasilnya bisa langsung diperiksa mata
 * sebelum dikirim ke pelanggan.
 */
export default function LayoutCetak({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-muted/40 print:bg-white">
      <div className="mx-auto max-w-[210mm] px-4 py-6 print:max-w-none print:p-0">
        <div className="flex items-center justify-between gap-3 pb-4 print:hidden">
          <p className="text-sm text-muted-foreground">
            Tekan Cetak, lalu pilih <strong className="text-foreground">Save as PDF</strong> pada
            tujuan pencetak.
          </p>
          <div className="flex items-center gap-3">
            <SkalaCetak />
            <TombolCetak />
          </div>
        </div>

        <article className="lembar-cetak rounded-lg border bg-white p-[12mm] text-black shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {children}
        </article>
      </div>
    </div>
  );
}
