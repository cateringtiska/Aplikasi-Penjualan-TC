import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DokumenCetak } from "@/components/dokumen-cetak";
import { isiDokumenPenawaran } from "@/lib/isi-dokumen";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/penawaran/[id]/cetak">): Promise<Metadata> {
  const { id } = await params;
  // Judul tab saja. Halamannya sendiri yang menyaring; kalau dokumennya
  // bukan miliknya, yang terbuka tetap halaman "tidak ditemukan".
  const p = await prisma.quotations.findUnique({
    where: { id: BigInt(id) },
    select: { quotation_number: true },
  });
  return { title: p ? `Quotation ${p.quotation_number}` : "Quotation" };
}

export default async function CetakPenawaran({ params }: PageProps<"/penawaran/[id]/cetak">) {
  const sesi = await wajibIzin("penawaran");
  const { id } = await params;

  // Dibaca lewat satu pintu yang sama dengan unduhan Excel-nya, supaya
  // kertas dan berkasnya tidak pernah berbeda isi. Lihat lib/isi-dokumen.ts.
  const isi = await isiDokumenPenawaran(id, hanyaMiliknya(sesi));
  if (!isi) notFound();

  return <DokumenCetak isi={isi} />;
}
