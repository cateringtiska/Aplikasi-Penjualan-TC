import type { Metadata } from "next";

import { Halaman, KepalaHalaman } from "@/components/halaman";
import { tautanTandaTangan } from "@/lib/penyimpanan";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

import { type BarisPenandatangan, DaftarPenandatangan } from "./daftar-penandatangan";
import { FormPerusahaan } from "./form-perusahaan";

export const metadata: Metadata = { title: "Pengaturan company" };
export const dynamic = "force-dynamic";

export default async function HalamanPerusahaan() {
  await wajibPeran();

  const [p, penandatangan] = await Promise.all([
    prisma.company_settings.findUnique({ where: { id: BigInt(1) } }),
    prisma.signatories.findMany({
      orderBy: [{ is_active: "desc" }, { sort_order: "asc" }, { id: "asc" }],
      select: { id: true, name: true, signature_path: true, is_active: true },
    }),
  ]);

  const barisPenandatangan: BarisPenandatangan[] = await Promise.all(
    penandatangan.map(async (s) => ({
      id: s.id.toString(),
      nama: s.name,
      tautanTtd: await tautanTandaTangan(s.signature_path),
      aktif: s.is_active,
    })),
  );

  return (
    <Halaman>
      <KepalaHalaman
        judul="Pengaturan company"
        keterangan="Identitas, rekening, dan teks standar yang ikut tercetak di dokumen."
      />

      <FormPerusahaan
        isi={{
          company_name: p?.company_name ?? "",
          bank_name: p?.bank_name ?? "",
          bank_account_number: p?.bank_account_number ?? "",
          bank_account_holder: p?.bank_account_holder ?? "",
          bank_code: p?.bank_code ?? "",
          swift_code: p?.swift_code ?? "",
          payment_terms_default: p?.payment_terms_default ?? "",
          quotation_terms_default: p?.quotation_terms_default ?? "",
          logo_path: p?.logo_path ?? null,
        }}
      />

      {/* Penandatangan dikelola terpisah dari formulir di atas: tiap orang
          membawa berkas gambarnya sendiri, dan satu formulir yang
          menanggung beberapa unggahan sekaligus gagal seluruhnya kalau
          salah satunya bermasalah. */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Penandatangan</h2>
        <p className="mt-0.5 pb-3 text-xs text-muted-foreground">
          Nama dan tanda tangan yang bisa dipilih saat membuat quotation atau invoice. Yang
          dinonaktifkan hilang dari pilihan dokumen baru, tetapi tetap tercetak di dokumen
          yang sudah memakainya.
        </p>

        <DaftarPenandatangan baris={barisPenandatangan} />
      </section>
    </Halaman>
  );
}
