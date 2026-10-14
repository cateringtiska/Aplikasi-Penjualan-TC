import type { Metadata } from "next";

import { FormDokumen } from "@/components/form-dokumen";
import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { wajibIzin } from "@/lib/rbac";
import { penandatanganAktif } from "@/lib/penandatangan";

import { hariIni, ISTILAH_PENAWARAN, pilihanForm } from "../data";
import { simpanPenawaran } from "../simpan";

export const metadata: Metadata = { title: "Quotation baru" };
export const dynamic = "force-dynamic";

export default async function HalamanPenawaranBaru() {
  await wajibIzin("penawaran");

  const [{ pelanggan, produk }, pengaturan] = await Promise.all([
    pilihanForm(),
    prisma.company_settings.findUnique({
      where: { id: BigInt(1) },
      select: { quotation_terms_default: true },
    }),
  ]);

  const penandatangan = await penandatanganAktif();

  return (
    <Halaman>
      <KepalaHalaman
        judul="Quotation baru"
        keterangan="Nomor quotation dibuat otomatis setelah disimpan."
      />

      <FormDokumen
        aksi={simpanPenawaran}
        istilah={ISTILAH_PENAWARAN}
        pelanggan={pelanggan}
        produk={produk}
        penandatangan={penandatangan}
        isiAwal={{
          customer_id: "",
          contact_person: "",
          contact_phone: "",
          tanggal: hariIni(),
          tanggal_akhir: hariIni(14),
          event_dates: [],
          event_type: "",
          event_time: "",
          guest_count: "",
          fnb_planner: "",
          venue: "",
          notes: "",
          service_charge_percent: "",
          delivery_amount: "",
          biaya_tambahan: [],
          pb1_enabled: false,
          pb1_percent: "10",
          signatory_id: penandatangan[0]?.id ?? "",
          // Quotation MENDAHULUI PO customer, jadi selalu kosong.
          po_reference: "",
          show_payment_terms: Boolean(pengaturan?.quotation_terms_default),
          payment_terms: pengaturan?.quotation_terms_default ?? "",
          items: [],
        }}
      />
    </Halaman>
  );
}
