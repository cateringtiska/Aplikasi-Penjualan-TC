import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DokumenDapur } from "@/components/dokumen-dapur";
import { isiDokumenTagihan } from "@/lib/isi-dokumen";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/tagihan/[id]/dapur">): Promise<Metadata> {
  const { id } = await params;
  const t = await prisma.invoices.findUnique({
    where: { id: BigInt(id) },
    select: { invoice_number: true },
  });
  return { title: t ? `PO To Kitchen ${t.invoice_number}` : "PO To Kitchen" };
}

export default async function DapurTagihan({ params }: PageProps<"/tagihan/[id]/dapur">) {
  const sesi = await wajibIzin("tagihan");
  const { id } = await params;

  // Dibaca lewat pintu yang sama dengan dokumen untuk customer, supaya
  // dapur dan customer tidak pernah memegang daftar item yang berbeda.
  // Harga memang ikut terbaca di sini; yang TIDAK ikut adalah
  // penggambarannya — lihat catatan di components/dokumen-dapur.tsx.
  const isi = await isiDokumenTagihan(id, hanyaMiliknya(sesi));
  if (!isi) notFound();

  return (
    <DokumenDapur
      isi={{
        nomor: isi.nomor,
        labelNomor: isi.labelNomor,
        revisi: isi.revisi,
        pemesan: isi.pelanggan.nama,
        alamat: isi.pelanggan.alamat,
        kontak: isi.kontak,
        acara: {
          tanggal: isi.acara.tanggal,
          jenis: isi.acara.jenis,
          jam: isi.acara.jam,
          venue: isi.acara.venue,
          tamu: isi.acara.tamu,
        },
        baris: isi.baris,
        catatan: isi.catatan,
      }}
    />
  );
}
