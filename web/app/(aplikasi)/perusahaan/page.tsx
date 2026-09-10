import type { Metadata } from "next";

import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

import { FormPerusahaan } from "./form-perusahaan";

export const metadata: Metadata = { title: "Pengaturan perusahaan" };
export const dynamic = "force-dynamic";

export default async function HalamanPerusahaan() {
  await wajibPeran();

  const p = await prisma.company_settings.findUnique({ where: { id: BigInt(1) } });

  return (
    <Halaman>
      <KepalaHalaman
        judul="Pengaturan perusahaan"
        keterangan="Identitas, rekening, dan teks standar yang ikut tercetak di dokumen."
      />

      <FormPerusahaan
        isi={{
          company_name: p?.company_name ?? "",
          signature_name: p?.signature_name ?? "",
          bank_name: p?.bank_name ?? "",
          bank_account_number: p?.bank_account_number ?? "",
          bank_account_holder: p?.bank_account_holder ?? "",
          payment_terms_default: p?.payment_terms_default ?? "",
          quotation_terms_default: p?.quotation_terms_default ?? "",
          logo_path: p?.logo_path ?? null,
          signature_path: p?.signature_path ?? null,
        }}
      />
    </Halaman>
  );
}
