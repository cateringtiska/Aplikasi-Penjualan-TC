import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DokumenCetak } from "@/components/dokumen-cetak";
import { tautanTandaTangan } from "@/lib/penyimpanan";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/penawaran/[id]/cetak">): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.quotations.findUnique({
    where: { id: BigInt(id) },
    select: { quotation_number: true },
  });
  // Nama berkas PDF hasil "Save as PDF" diambil dari judul halaman ini.
  return { title: p ? `Quotation ${p.quotation_number}` : "Quotation" };
}

export default async function CetakPenawaran({ params }: PageProps<"/penawaran/[id]/cetak">) {
  await wajibPeran("sales", "finance");

  const { id } = await params;

  const [p, perusahaan] = await Promise.all([
    prisma.quotations.findUnique({
      where: { id: BigInt(id) },
      include: {
        customers: true,
        quotation_charges: { orderBy: { id: "asc" } },
        quotation_items: {
          where: { parent_id: null },
          orderBy: { id: "asc" },
          include: {
            other_quotation_items: {
              orderBy: { id: "asc" },
              select: {
                id: true,
                item_name: true,
                unit: true,
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

  if (!p) notFound();

  return (
    <DokumenCetak
      isi={{
        judul: "Quotation",
        labelNomor: "No. Quotation",
        nomor: p.quotation_number,
        tanggal: p.quotation_date,
        labelTanggalKedua: "Berlaku s/d",
        tanggalKedua: p.valid_until,

        pelanggan: { nama: p.customers.name, alamat: p.customers.address },
        kontak: { nama: p.contact_person, telepon: p.contact_phone },

        acara: {
          tanggal: p.event_date,
          hari: p.event_days,
          tamu: p.guest_count,
          planner: p.fnb_planner,
          jam: p.event_time,
          venue: p.venue,
          jenis: p.event_type,
        },

        baris: p.quotation_items.map((b) => ({
          id: b.id.toString(),
          item_name: b.item_name,
          unit: b.unit,
          qty: b.qty.toString(),
          price: b.price.toString(),
          subtotal: b.subtotal.toString(),
          is_compliment: b.is_compliment,
          anak: b.other_quotation_items.map((a) => ({
            id: a.id.toString(),
            item_name: a.item_name,
            unit: a.unit,
            qty: a.qty.toString(),
            price: a.price.toString(),
            subtotal: a.subtotal.toString(),
          })),
        })),

        subtotal: p.subtotal.toString(),
        service_charge_percent: p.service_charge_percent?.toString() ?? null,
        service_charge_amount: p.service_charge_amount.toString(),
        pb1_enabled: p.pb1_enabled,
        pb1_percent: p.pb1_percent?.toString() ?? null,
        pb1_amount: p.pb1_amount.toString(),
        delivery_amount: p.delivery_amount.toString(),
        biaya_tambahan: p.quotation_charges.map((b) => ({
          id: b.id.toString(),
          label: b.label,
          amount: b.amount.toString(),
        })),
        grand_total: p.grand_total.toString(),

        catatan: p.notes,
        syarat: p.show_payment_terms ? p.payment_terms : null,

        perusahaan: {
          company_name: perusahaan?.company_name ?? "Perusahaan",
          logo_path: perusahaan?.logo_path ?? null,
          signature_url: await tautanTandaTangan(perusahaan?.signature_path ?? null),
          signature_name: perusahaan?.signature_name ?? null,
          bank_name: perusahaan?.bank_name ?? null,
          bank_account_number: perusahaan?.bank_account_number ?? null,
          bank_account_holder: perusahaan?.bank_account_holder ?? null,
        },
      }}
    />
  );
}
