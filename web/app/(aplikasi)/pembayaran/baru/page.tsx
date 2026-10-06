import type { Metadata } from "next";

import { Halaman, KepalaHalaman } from "@/components/halaman";
import { hariIni } from "@/lib/pilihan";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

import { FormPembayaran, type BarisTagihan } from "../form-pembayaran";

export const metadata: Metadata = { title: "Catat payment" };
export const dynamic = "force-dynamic";

export default async function HalamanPembayaranBaru({
  searchParams,
}: PageProps<"/pembayaran/baru">) {
  await wajibPeran("finance");

  const { tagihan: idTagihan } = await searchParams;
  const dariTagihan = typeof idTagihan === "string" ? idTagihan : "";

  const pelanggan = await prisma.customers.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, customer_code: true, pic_name: true },
  });

  // Kalau datang dari halaman tagihan, pelanggannya langsung terpilih dan
  // tagihan itu langsung tercentang sejumlah sisanya.
  let pelangganAwal = "";
  let daftarTagihan: BarisTagihan[] = [];

  if (dariTagihan) {
    const t = await prisma.invoices.findUnique({
      where: { id: BigInt(dariTagihan) },
      select: { customer_id: true },
    });

    if (t) {
      pelangganAwal = t.customer_id.toString();

      const belumLunas = await prisma.invoices.findMany({
        where: {
          customer_id: t.customer_id,
          status: { in: ["unpaid", "partial", "overdue"] },
        },
        orderBy: { due_date: "asc" },
        select: {
          id: true,
          invoice_number: true,
          due_date: true,
          grand_total: true,
          paid_amount: true,
          status: true,
          subtotal: true,
          service_charge_amount: true,
        },
      });

      daftarTagihan = belumLunas.map((x) => ({
        id: x.id.toString(),
        nomor: x.invoice_number,
        jatuhTempo: x.due_date.toISOString().slice(0, 10),
        total: x.grand_total.toString(),
        dibayar: x.paid_amount.toString(),
        sisa: x.grand_total.minus(x.paid_amount).toString(),
        status: x.status,
        dasarPph: x.subtotal.plus(x.service_charge_amount).toString(),
      }));
    }
  }

  return (
    <Halaman>
      <KepalaHalaman
        judul="Catat payment"
        keterangan="Satu setoran boleh menutup beberapa invoice sekaligus."
      />

      <FormPembayaran
        pelanggan={pelanggan.map((p) => ({
          id: p.id.toString(),
          nama: p.name,
          kode: p.customer_code,
          pic: p.pic_name,
        }))}
        pelangganAwal={pelangganAwal}
        tagihanAwal={daftarTagihan}
        tandaiAwal={dariTagihan || undefined}
        tanggalAwal={hariIni()}
      />
    </Halaman>
  );
}
