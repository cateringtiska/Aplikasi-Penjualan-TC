import type { Metadata } from "next";

import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

import { hariIni, pilihanForm } from "../data";
import { FormPenawaran } from "../form-penawaran";

export const metadata: Metadata = { title: "Penawaran baru" };
export const dynamic = "force-dynamic";

export default async function HalamanPenawaranBaru() {
  await wajibPeran("sales", "finance");

  const [{ pelanggan, produk }, pengaturan] = await Promise.all([
    pilihanForm(),
    prisma.company_settings.findUnique({
      where: { id: BigInt(1) },
      select: { quotation_terms_default: true },
    }),
  ]);

  return (
    <Halaman>
      <KepalaHalaman
        judul="Penawaran baru"
        keterangan="Nomor penawaran dibuat otomatis setelah disimpan."
      />

      <FormPenawaran
        pelanggan={pelanggan}
        produk={produk}
        isiAwal={{
          customer_id: "",
          contact_person: "",
          contact_phone: "",
          quotation_date: hariIni(),
          valid_until: hariIni(14),
          event_date: "",
          event_days: "",
          event_type: "",
          event_time: "",
          guest_count: "",
          fnb_planner: "",
          venue: "",
          notes: "",
          service_charge_percent: "",
          pb1_enabled: false,
          pb1_percent: "10",
          show_payment_terms: Boolean(pengaturan?.quotation_terms_default),
          payment_terms: pengaturan?.quotation_terms_default ?? "",
          items: [],
        }}
      />
    </Halaman>
  );
}
