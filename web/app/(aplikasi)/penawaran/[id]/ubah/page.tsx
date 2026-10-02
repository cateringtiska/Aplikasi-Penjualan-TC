import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FormDokumen, tanggalKosong } from "@/components/form-dokumen";
import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibPeran } from "@/lib/rbac";

import { ISTILAH_PENAWARAN, pilihanForm, tanggalUntukInput } from "../../data";
import { tanggalAcaraUntukFormulir } from "@/lib/pilihan";
import { simpanPenawaran } from "../../simpan";

export const metadata: Metadata = { title: "Ubah quotation" };
export const dynamic = "force-dynamic";

export default async function HalamanUbahPenawaran({
  params,
}: PageProps<"/penawaran/[id]/ubah">) {
  const sesi = await wajibPeran("sales", "finance");

  const { id } = await params;

  const [penawaran, { pelanggan, produk }] = await Promise.all([
    prisma.quotations.findFirst({
      where: { id: BigInt(id), ...hanyaMiliknya(sesi) },
      include: {
        quotation_charges: { orderBy: { id: "asc" } },
        quotation_event_dates: { orderBy: { event_date: "asc" } },
        quotation_items: {
          where: { parent_id: null },
          orderBy: { id: "asc" },
          include: {
            other_quotation_items: { orderBy: { id: "asc" },
              select: { item_name: true, unit: true, day: true, qty: true, price: true },
             },
          },
        },
      },
    }),
    pilihanForm(),
  ]);

  if (!penawaran) notFound();

  // Penawaran yang sudah disetujui adalah kesepakatan dengan pelanggan.
  // Mengubahnya diam-diam membuat dokumen yang sudah dikirim tidak cocok lagi.
  if (penawaran.status === "approved") {
    redirect(`/penawaran/${id}?terkunci=1`);
  }

  return (
    <Halaman>
      <KepalaHalaman
        judul={`Ubah ${penawaran.quotation_number}`}
        keterangan="Nomor quotation tidak berubah setelah disimpan ulang."
      />

      <FormDokumen
        aksi={simpanPenawaran}
        istilah={ISTILAH_PENAWARAN}
        pelanggan={pelanggan}
        produk={produk}
        isiAwal={{
          id: penawaran.id.toString(),
          customer_id: penawaran.customer_id.toString(),
          contact_person: penawaran.contact_person ?? "",
          contact_phone: penawaran.contact_phone ?? "",
          tanggal: tanggalUntukInput(penawaran.quotation_date),
          tanggal_akhir: tanggalUntukInput(penawaran.valid_until),
          event_dates: tanggalAcaraUntukFormulir(
            penawaran.quotation_event_dates,
            penawaran.event_date,
            penawaran.event_days,
          ).map((s) => tanggalKosong(s)),
          event_type: penawaran.event_type ?? "",
          event_time: penawaran.event_time ?? "",
          guest_count: penawaran.guest_count?.toString() ?? "",
          fnb_planner: penawaran.fnb_planner ?? "",
          venue: penawaran.venue ?? "",
          notes: penawaran.notes ?? "",
          delivery_amount: Number(penawaran.delivery_amount) > 0 ? Number(penawaran.delivery_amount).toString() : "",
          biaya_tambahan: penawaran.quotation_charges.map((b) => ({
            kunci: `c${b.id}`,
            label: b.label,
            amount: Number(b.amount).toLocaleString("id-ID"),
          })),
          service_charge_percent: penawaran.service_charge_percent
            ? Number(penawaran.service_charge_percent).toString()
            : "",
          pb1_enabled: penawaran.pb1_enabled,
          pb1_percent: penawaran.pb1_percent
            ? Number(penawaran.pb1_percent).toString()
            : "10",
          show_payment_terms: penawaran.show_payment_terms,
          payment_terms: penawaran.payment_terms ?? "",
          items: penawaran.quotation_items.map((b) => ({
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
            children: b.other_quotation_items.map((a, i) => ({
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
