import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormDokumen, type IsiAwal } from "@/components/form-dokumen";
import { tanggalKosong } from "@/lib/bentuk-form";
import { Halaman, KepalaHalaman } from "@/components/halaman";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, wajibPeran } from "@/lib/rbac";

import { hariIni, ISTILAH_TAGIHAN, pilihanForm } from "../data";
import { tanggalAcaraUntukFormulir } from "@/lib/pilihan";
import { simpanTagihan } from "../simpan";

export const metadata: Metadata = { title: "Invoice baru" };
export const dynamic = "force-dynamic";

export default async function HalamanTagihanBaru({ searchParams }: PageProps<"/tagihan/baru">) {
  const sesi = await wajibPeran("sales", "finance");

  const { dari } = await searchParams;
  const idPenawaran = typeof dari === "string" ? dari : "";

  const [{ pelanggan, produk }, pengaturan] = await Promise.all([
    pilihanForm(),
    prisma.company_settings.findUnique({
      where: { id: BigInt(1) },
      select: { payment_terms_default: true },
    }),
  ]);

  const kosong: IsiAwal = {
    customer_id: "",
    contact_person: "",
    contact_phone: "",
    tanggal: hariIni(),
    tanggal_akhir: hariIni(14),
    event_dates: [],
    event_type: "",
    event_time: "",
    guest_count: "",
    fnb_planner: "",
    venue: "",
    notes: "",
    service_charge_percent: "",
    delivery_amount: "",
    biaya_tambahan: [],
    pb1_enabled: false,
    pb1_percent: "10",
    show_payment_terms: Boolean(pengaturan?.payment_terms_default),
    payment_terms: pengaturan?.payment_terms_default ?? "",
    items: [],
  };

  let isiAwal = kosong;
  let asal: { nomor: string } | null = null;

  if (idPenawaran) {
    const p = await prisma.quotations.findFirst({
      where: { id: BigInt(idPenawaran), ...hanyaMiliknya(sesi) },
      include: {
        invoices: { take: 1, select: { id: true } },
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
    });

    if (!p) redirect("/tagihan/baru");

    // Satu penawaran hanya boleh menurunkan satu tagihan. Tanpa penjagaan ini,
    // menekan tombol dua kali menghasilkan tagihan ganda ke pelanggan yang sama.
    if (p.invoices[0]) redirect(`/tagihan/${p.invoices[0].id}?sudah_ada=1`);

    asal = { nomor: p.quotation_number };

    isiAwal = {
      ...kosong,
      customer_id: p.customer_id.toString(),
      contact_person: p.contact_person ?? "",
      contact_phone: p.contact_phone ?? "",
      event_dates: tanggalAcaraUntukFormulir(
        p.quotation_event_dates,
        p.event_date,
        p.event_days,
      ).map((s) => tanggalKosong(s)),
      event_type: p.event_type ?? "",
      event_time: p.event_time ?? "",
      guest_count: p.guest_count?.toString() ?? "",
      fnb_planner: p.fnb_planner ?? "",
      venue: p.venue ?? "",
      notes: `Dikonversi dari Penawaran ${p.quotation_number}`,
      delivery_amount: Number(p.delivery_amount) > 0 ? Number(p.delivery_amount).toString() : "",
      // Biaya tambahan ikut pindah. Tagihan yang kehilangan baris ini akan
      // menagih lebih kecil dari penawaran yang sudah disetujui customer.
      biaya_tambahan: p.quotation_charges.map((b) => ({
        kunci: `qc${b.id}`,
        label: b.label,
        amount: Number(b.amount).toLocaleString("id-ID"),
      })),
      service_charge_percent: p.service_charge_percent
        ? Number(p.service_charge_percent).toString()
        : "",
      pb1_enabled: p.pb1_enabled,
      pb1_percent: p.pb1_percent ? Number(p.pb1_percent).toString() : "10",
      show_payment_terms: p.show_payment_terms,
      payment_terms: pengaturan?.payment_terms_default ?? p.payment_terms ?? "",
      items: p.quotation_items.map((b) => ({
        kunci: `q${b.id}`,
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
          kunci: `q${b.id}-${i}`,
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
    };
  }

  return (
    <Halaman>
      <KepalaHalaman
        judul="Invoice baru"
        keterangan={
          asal
            ? `Seluruh rincian disalin dari penawaran ${asal.nomor}. Periksa tanggal jatuh temponya sebelum menyimpan.`
            : "Nomor invoice dibuat otomatis setelah disimpan."
        }
      />

      <FormDokumen
        aksi={simpanTagihan}
        istilah={ISTILAH_TAGIHAN}
        pelanggan={pelanggan}
        produk={produk}
        isiAwal={isiAwal}
        medanTambahan={idPenawaran ? { dari_penawaran: idPenawaran } : undefined}
      />
    </Halaman>
  );
}
