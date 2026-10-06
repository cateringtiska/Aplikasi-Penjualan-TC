import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { wajibIzin } from "@/lib/rbac";

import { tagihanBelumLunas } from "../../actions";
import { FormPembayaran } from "../../form-pembayaran";

export const metadata: Metadata = { title: "Ubah payment" };
export const dynamic = "force-dynamic";

export default async function HalamanUbahPembayaran({
  params,
}: PageProps<"/pembayaran/[id]/ubah">) {
  await wajibIzin("pembayaran");

  const { id } = await params;

  const [pembayaran, pelanggan] = await Promise.all([
    prisma.payments.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        payment_number: true,
        payment_date: true,
        payment_method: true,
        bank_cash: true,
        notes: true,
        total_amount: true,
        pph23_amount: true,
        pph23_bukti: true,
        customer_id: true,
        payment_details: { select: { invoice_id: true, amount_applied: true } },
      },
    }),
    prisma.customers.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, customer_code: true, pic_name: true },
    }),
  ]);

  if (!pembayaran) notFound();

  // Daftar tagihannya menyebut pembayaran ini, supaya invoice yang sudah
  // lunas OLEH PEMBAYARAN INI tetap muncul beserta alokasinya. Lihat catatan
  // di tagihanBelumLunas().
  const daftarTagihan = await tagihanBelumLunas(
    pembayaran.customer_id.toString(),
    pembayaran.id.toString(),
  );

  const alokasi: Record<string, string> = {};
  for (const r of pembayaran.payment_details) {
    const kunci = r.invoice_id.toString();
    alokasi[kunci] = Number(r.amount_applied).toLocaleString("id-ID");
  }

  return (
    <Halaman>
      <KepalaHalaman
        judul={`Ubah ${pembayaran.payment_number}`}
        keterangan="Nomor payment tidak berubah. Status invoice yang terkait dihitung ulang setelah disimpan."
      />

      <FormPembayaran
        id={pembayaran.id.toString()}
        pelanggan={pelanggan.map((p) => ({
          id: p.id.toString(),
          nama: p.name,
          kode: p.customer_code,
          pic: p.pic_name,
        }))}
        pelangganAwal={pembayaran.customer_id.toString()}
        tagihanAwal={daftarTagihan}
        tanggalAwal={pembayaran.payment_date.toISOString().slice(0, 10)}
        isiAwal={{
          pph23: Number(pembayaran.pph23_amount) > 0
            ? Number(pembayaran.pph23_amount).toLocaleString("id-ID")
            : "",
          buktiPph: pembayaran.pph23_bukti ?? "",
          metode: pembayaran.payment_method,
          bankCash: pembayaran.bank_cash ?? "",
          catatan: pembayaran.notes ?? "",
          totalDiterima: Number(pembayaran.total_amount).toLocaleString("id-ID"),
          alokasi,
        }}
      />
    </Halaman>
  );
}
