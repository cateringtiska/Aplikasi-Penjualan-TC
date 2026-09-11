import { z } from "zod";

import { NILAI_KATEGORI } from "./biaya";
import { uraikanRupiah } from "./uang";

/* ==========================================================================
   MEMBACA FORMULIR BIAYA

   Penawaran dan tagihan memakai formulir biaya yang sama persis, hanya
   menulis ke tabel yang berbeda. Aturan isiannya dikumpulkan di sini supaya
   keduanya tidak bisa menyimpang — biaya yang boleh masuk ke penawaran harus
   sama dengan yang boleh masuk ke tagihan, karena barisnya memang disalin
   dari yang satu ke yang lain.
   ========================================================================== */

const skema = z.object({
  id: z.string().trim().optional(),
  id_dokumen: z.string().trim().min(1),
  category: z.enum(NILAI_KATEGORI as unknown as [string, ...string[]], {
    message: "Pilih kategori biaya.",
  }),
  description: z.string().trim().min(3, "Keterangan minimal 3 huruf.").max(255),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/** Kolom-kolom yang siap ditulis ke quotation_costs maupun invoice_costs. */
export type IsiBiaya = {
  category: string;
  description: string;
  estimated_amount: string | null;
  actual_amount: string | null;
  status: string;
  notes: string | null;
  updated_at: Date;
};

export type HasilBacaBiaya =
  | { ok: true; id: string | undefined; idDokumen: string; isi: IsiBiaya }
  | { ok: false; galat: Record<string, string> };

export function bacaFormulirBiaya(data: FormData): HasilBacaBiaya {
  const hasil = skema.safeParse(Object.fromEntries(data));

  if (!hasil.success) {
    const bidang = z.flattenError(hasil.error).fieldErrors;
    return {
      ok: false,
      galat: Object.fromEntries(
        Object.entries(bidang).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }

  const { id, id_dokumen, category, description, notes } = hasil.data;

  const estimasi = uraikanRupiah(data.get("estimated_amount"));
  const aktual = uraikanRupiah(data.get("actual_amount"));

  const teksEstimasi = String(data.get("estimated_amount") ?? "").trim();
  const teksAktual = String(data.get("actual_amount") ?? "").trim();

  if (teksEstimasi !== "" && estimasi === null) {
    return { ok: false, galat: { estimated_amount: "Isi angka saja, contoh: 5.000.000" } };
  }
  if (teksAktual !== "" && aktual === null) {
    return { ok: false, galat: { actual_amount: "Isi angka saja, contoh: 5.400.000" } };
  }
  if (estimasi === null && aktual === null) {
    return {
      ok: false,
      galat: { estimated_amount: "Isi minimal salah satu: estimasi atau aktual." },
    };
  }

  return {
    ok: true,
    id,
    idDokumen: id_dokumen,
    isi: {
      category,
      description,
      estimated_amount: estimasi ? estimasi.toFixed(2) : null,
      actual_amount: aktual ? aktual.toFixed(2) : null,
      // Sebuah baris dianggap "aktual" hanya kalau angkanya benar-benar di
      // atas nol — sama dengan aturan yang dipakai saat menghitung nilainya.
      status: aktual && aktual.gt(0) ? "aktual" : "estimasi",
      notes: notes || null,
      updated_at: new Date(),
    },
  };
}
