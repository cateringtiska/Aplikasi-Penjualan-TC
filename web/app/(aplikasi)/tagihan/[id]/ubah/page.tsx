import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FormDokumen } from "@/components/form-dokumen";
import { tanggalKosong } from "@/lib/bentuk-form";
import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";
import { penandatanganAktif } from "@/lib/penandatangan";

import { ISTILAH_TAGIHAN, pilihanForm, tanggalUntukInput } from "../../data";
import { tanggalAcaraUntukFormulir } from "@/lib/pilihan";
import { simpanTagihan } from "../../simpan";

export const metadata: Metadata = { title: "Ubah invoice" };
export const dynamic = "force-dynamic";

export default async function HalamanUbahTagihan({ params }: PageProps<"/tagihan/[id]/ubah">) {
  const sesi = await wajibIzin("tagihan");

  const { id } = await params;

  const [tagihan, { pelanggan, produk }] = await Promise.all([
    prisma.invoices.findFirst({
      where: { id: BigInt(id), ...hanyaMiliknya(sesi) },
      include: {
        invoice_charges: { orderBy: { id: "asc" } },
        invoice_event_dates: { orderBy: { event_date: "asc" } },
        invoice_items: {
          where: { parent_id: null },
          orderBy: { id: "asc" },
          include: {
            other_invoice_items: { orderBy: { id: "asc" },
              select: { item_name: true, unit: true, day: true, qty: true, price: true },
             },
          },
        },
      },
    }),
    pilihanForm(),
  ]);

  if (!tagihan) notFound();

  // Mengubah rincian tagihan yang sudah dibayar akan membuat catatan
  // pembayaran tidak lagi cocok dengan nilainya.
  if (Number(tagihan.paid_amount) > 0 || tagihan.status === "cancelled") {
    redirect(`/tagihan/${id}`);
  }

  const penandatangan = await penandatanganAktif();

  return (
    <Halaman>
      <KepalaHalaman
        judul={`Ubah ${tagihan.invoice_number}`}
        keterangan="Nomor invoice tidak berubah setelah disimpan ulang."
      />

      <FormDokumen
        aksi={simpanTagihan}
        istilah={ISTILAH_TAGIHAN}
        pelanggan={pelanggan}
        produk={produk}
        penandatangan={penandatangan}
        isiAwal={{
          id: tagihan.id.toString(),
          customer_id: tagihan.customer_id.toString(),
          contact_person: tagihan.contact_person ?? "",
          contact_phone: tagihan.contact_phone ?? "",
          tanggal: tanggalUntukInput(tagihan.invoice_date),
          tanggal_akhir: tanggalUntukInput(tagihan.due_date),
          event_dates: tanggalAcaraUntukFormulir(
            tagihan.invoice_event_dates,
            tagihan.event_date,
            tagihan.event_days,
          ).map((s) => tanggalKosong(s)),
          event_type: tagihan.event_type ?? "",
          event_time: tagihan.event_time ?? "",
          guest_count: tagihan.guest_count?.toString() ?? "",
          fnb_planner: tagihan.fnb_planner ?? "",
          venue: tagihan.venue ?? "",
          notes: tagihan.notes ?? "",
          delivery_amount: Number(tagihan.delivery_amount) > 0 ? Number(tagihan.delivery_amount).toString() : "",
          biaya_tambahan: tagihan.invoice_charges.map((b) => ({
            kunci: `c${b.id}`,
            label: b.label,
            amount: Number(b.amount).toLocaleString("id-ID"),
          })),
          service_charge_percent: tagihan.service_charge_percent
            ? Number(tagihan.service_charge_percent).toString()
            : "",
          pb1_enabled: tagihan.pb1_enabled,
          pb1_percent: tagihan.pb1_percent ? Number(tagihan.pb1_percent).toString() : "10",
          signatory_id:
            tagihan.signatory_id?.toString() ?? penandatangan[0]?.id ?? "",
          show_payment_terms: tagihan.show_payment_terms,
          payment_terms: tagihan.payment_terms ?? "",
          items: tagihan.invoice_items.map((b) => ({
            kunci: b.id.toString(),
            product_id: b.product_id?.toString() ?? "",
            day: Number(b.day).toString(),
            item_name: b.item_name,
            unit: b.unit ?? "",
            qty: Number(b.qty).toLocaleString("id-ID"),
            price: Number(b.price).toLocaleString("id-ID"),
            is_compliment: b.is_compliment,
            charge_service: b.charge_service,
            charge_pb1: b.charge_pb1,
            children: b.other_invoice_items.map((a, i) => ({
              kunci: `${b.id}-${i}`,
              item_name: a.item_name,
              unit: a.unit ?? "",
              // Sama dengan induknya berarti DIBIARKAN KOSONG, supaya tetap
              // mewarisi. Menampilkannya sebagai angka membuat orang mengira
              // ia terpisah dari induknya.
              day: Number(a.day) === Number(b.day) ? "" : Number(a.day).toString(),
              qty: a.qty && Number(a.qty) > 0 ? Number(a.qty).toString() : "",
              price: a.price && Number(a.price) > 0 ? Number(a.price).toString() : "",
            })),
          })),
        }}
      />
    </Halaman>
  );
}
