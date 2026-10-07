import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DokumenDapur } from "@/components/dokumen-dapur";
import { isiDokumenPenawaran } from "@/lib/isi-dokumen";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/penawaran/[id]/dapur">): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.quotations.findUnique({
    where: { id: BigInt(id) },
    select: { quotation_number: true },
  });
  return { title: p ? `Dapur ${p.quotation_number}` : "Surat pesanan dapur" };
}

export default async function DapurPenawaran({ params }: PageProps<"/penawaran/[id]/dapur">) {
  const sesi = await wajibIzin("penawaran");
  const { id } = await params;

  // Dibaca lewat pintu yang sama dengan dokumen untuk customer, supaya
  // dapur dan customer tidak pernah memegang daftar item yang berbeda.
  // Harga memang ikut terbaca di sini; yang TIDAK ikut adalah
  // penggambarannya — lihat catatan di components/dokumen-dapur.tsx.
  const isi = await isiDokumenPenawaran(id, hanyaMiliknya(sesi));
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
        namaPerusahaan: isi.perusahaan.company_name,
      }}
    />
  );
}
