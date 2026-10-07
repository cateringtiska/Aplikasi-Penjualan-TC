import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DokumenCetak } from "@/components/dokumen-cetak";
import { isiDokumenTagihan } from "@/lib/isi-dokumen";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/tagihan/[id]/cetak">): Promise<Metadata> {
  const { id } = await params;
  // Judul tab saja. Halamannya sendiri yang menyaring; kalau dokumennya
  // bukan miliknya, yang terbuka tetap halaman "tidak ditemukan".
  const t = await prisma.invoices.findUnique({
    where: { id: BigInt(id) },
    select: { invoice_number: true },
  });
  return { title: t ? `Invoice ${t.invoice_number}` : "Invoice" };
}

export default async function CetakTagihan({ params }: PageProps<"/tagihan/[id]/cetak">) {
  const sesi = await wajibIzin("tagihan");
  const { id } = await params;

  // Dibaca lewat satu pintu yang sama dengan unduhan Excel-nya, supaya
  // kertas dan berkasnya tidak pernah berbeda isi. Lihat lib/isi-dokumen.ts.
  const isi = await isiDokumenTagihan(id, hanyaMiliknya(sesi));
  if (!isi) notFound();

  return <DokumenCetak isi={isi} />;
}
