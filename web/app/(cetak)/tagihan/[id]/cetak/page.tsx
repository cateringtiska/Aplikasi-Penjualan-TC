import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DokumenCetak } from "@/components/dokumen-cetak";
import { tautanTandaTangan } from "@/lib/penyimpanan";
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

  const [t, perusahaan] = await Promise.all([
    prisma.invoices.findFirst({
      where: { id: BigInt(id), ...hanyaMiliknya(sesi) },
      include: {
        customers: true,
        invoice_charges: { orderBy: { id: "asc" } },
        invoice_event_dates: { orderBy: { event_date: "asc" } },
        invoice_items: {
          where: { parent_id: null },
          orderBy: { id: "asc" },
          include: {
            other_invoice_items: {
              orderBy: { id: "asc" },
              select: {
                id: true,
                item_name: true,
                unit: true,
                day: true,
                qty: true,
                price: true,
                subtotal: true,
              },
            },
          },
        },
      },
    }),
    prisma.company_settings.findUnique({ where: { id: BigInt(1) } }),
  ]);

  if (!t) notFound();

  return (
    <DokumenCetak
      isi={{
        judul: "Invoice",
        labelNomor: "No. Invoice",
        nomor: t.invoice_number,
        tanggal: t.invoice_date,
        labelTanggalKedua: "Jatuh Tempo",
        tanggalKedua: t.due_date,

        pelanggan: { nama: t.customers.name, alamat: t.customers.address },
        kontak: { nama: t.contact_person, telepon: t.contact_phone },

        acara: {
          tanggal: t.invoice_event_dates.map((b) => b.event_date),
          tamu: t.guest_count,
          planner: t.fnb_planner,
          jam: t.event_time,
          venue: t.venue,
          jenis: t.event_type,
        },

        baris: t.invoice_items.map((b) => ({
          id: b.id.toString(),
          item_name: b.item_name,
          day: b.day.toString(),
          unit: b.unit,
          qty: b.qty.toString(),
          price: b.price.toString(),
          subtotal: b.subtotal.toString(),
          is_compliment: b.is_compliment,
          anak: b.other_invoice_items.map((a) => ({
            id: a.id.toString(),
            item_name: a.item_name,
            unit: a.unit,
            day: a.day.toString(),
            qty: a.qty.toString(),
            price: a.price.toString(),
            subtotal: a.subtotal.toString(),
          })),
        })),

        subtotal: t.subtotal.toString(),
        service_charge_percent: t.service_charge_percent?.toString() ?? null,
        service_charge_amount: t.service_charge_amount.toString(),
        pb1_enabled: t.pb1_enabled,
        pb1_percent: t.pb1_percent?.toString() ?? null,
        pb1_amount: t.pb1_amount.toString(),
        delivery_amount: t.delivery_amount.toString(),
        biaya_tambahan: t.invoice_charges.map((b) => ({
          id: b.id.toString(),
          label: b.label,
          amount: b.amount.toString(),
        })),
        grand_total: t.grand_total.toString(),

        catatan: t.notes,
        syarat: t.show_payment_terms ? t.payment_terms : null,

        perusahaan: {
          company_name: perusahaan?.company_name ?? "Perusahaan",
          logo_path: perusahaan?.logo_path ?? null,
          signature_url: await tautanTandaTangan(perusahaan?.signature_path ?? null),
          signature_name: perusahaan?.signature_name ?? null,
          bank_name: perusahaan?.bank_name ?? null,
          bank_account_number: perusahaan?.bank_account_number ?? null,
          bank_account_holder: perusahaan?.bank_account_holder ?? null,
          bank_code: perusahaan?.bank_code ?? null,
          swift_code: perusahaan?.swift_code ?? null,
        },
      }}
    />
  );
}
