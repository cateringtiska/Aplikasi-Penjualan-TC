import "server-only";

import type { IsiDokumen } from "@/components/dokumen-cetak";

import { tandaTanganDokumen } from "./penandatangan";
import { prisma } from "./prisma";
import type { SaringMilik } from "./rbac";

/* ==========================================================================
   ISI SATU DOKUMEN, SIAP DICETAK MAUPUN DIUNDUH

   Dipakai DUA kali untuk tiap jenis dokumen: halaman cetaknya, dan berkas
   Excel yang diunduh dari dokumen yang sama. Keduanya harus membaca data
   yang persis sama — kalau masing-masing menyusun sendiri, satu kolom yang
   lupa ikut diambil akan membuat kertas dan berkasnya berbeda isi, dan
   yang membandingkannya adalah customer.

   Susunan BARISNYA sendiri ada di lib/baris-cetak.ts; yang di sini hanya
   pembacaan datanya.
   ========================================================================== */

/** Kolom sub-item, sama untuk quotation maupun invoice. */
const KOLOM_ANAK = {
  id: true,
  item_name: true,
  unit: true,
  day: true,
  qty: true,
  price: true,
  subtotal: true,
} as const;

type BarisMentah = {
  id: bigint;
  item_name: string;
  unit: string | null;
  day: { toString(): string };
  qty: { toString(): string };
  price: { toString(): string };
  subtotal: { toString(): string };
  is_compliment: boolean;
};

type AnakMentah = {
  id: bigint;
  item_name: string;
  unit: string | null;
  day: { toString(): string };
  qty: { toString(): string };
  price: { toString(): string };
  subtotal: { toString(): string };
};

const susunBaris = (induk: BarisMentah, anak: AnakMentah[]) => ({
  id: induk.id.toString(),
  item_name: induk.item_name,
  unit: induk.unit,
  day: induk.day.toString(),
  qty: induk.qty.toString(),
  price: induk.price.toString(),
  subtotal: induk.subtotal.toString(),
  is_compliment: induk.is_compliment,
  anak: anak.map((a) => ({
    id: a.id.toString(),
    item_name: a.item_name,
    unit: a.unit,
    day: a.day.toString(),
    qty: a.qty.toString(),
    price: a.price.toString(),
    subtotal: a.subtotal.toString(),
  })),
});

/** Isi dokumen satu invoice, atau null kalau tidak ada / bukan miliknya. */
export async function isiDokumenTagihan(
  id: string,
  saring: SaringMilik,
): Promise<IsiDokumen | null> {
  const [t, perusahaan] = await Promise.all([
    prisma.invoices.findFirst({
      where: { id: BigInt(id), ...saring },
      include: {
        customers: true,
        invoice_charges: { orderBy: { id: "asc" } },
        invoice_event_dates: { orderBy: { event_date: "asc" } },
        invoice_items: {
          where: { parent_id: null },
          orderBy: { id: "asc" },
          include: { other_invoice_items: { orderBy: { id: "asc" }, select: KOLOM_ANAK } },
        },
      },
    }),
    prisma.company_settings.findUnique({ where: { id: BigInt(1) } }),
  ]);

  if (!t) return null;

  const ttd = await tandaTanganDokumen({
    idPenandatangan: t.signatory_id,
    namaCadangan: perusahaan?.signature_name ?? null,
    jalurCadangan: perusahaan?.signature_path ?? null,
  });

  return {
    judul: "Invoice",
    labelNomor: "No. Invoice",
    nomor: t.invoice_number,
    revisi: t.revision,
    tanggalRevisi: t.revised_at,
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

    baris: t.invoice_items.map((b) => susunBaris(b, b.other_invoice_items)),

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
      signature_url: ttd.tautan,
      signature_name: ttd.nama,
      bank_name: perusahaan?.bank_name ?? null,
      bank_account_number: perusahaan?.bank_account_number ?? null,
      bank_account_holder: perusahaan?.bank_account_holder ?? null,
      bank_code: perusahaan?.bank_code ?? null,
      swift_code: perusahaan?.swift_code ?? null,
    },
  };
}

/** Isi dokumen satu quotation, atau null kalau tidak ada / bukan miliknya. */
export async function isiDokumenPenawaran(
  id: string,
  saring: SaringMilik,
): Promise<IsiDokumen | null> {
  const [p, perusahaan] = await Promise.all([
    prisma.quotations.findFirst({
      where: { id: BigInt(id), ...saring },
      include: {
        customers: true,
        quotation_charges: { orderBy: { id: "asc" } },
        quotation_event_dates: { orderBy: { event_date: "asc" } },
        quotation_items: {
          where: { parent_id: null },
          orderBy: { id: "asc" },
          include: { other_quotation_items: { orderBy: { id: "asc" }, select: KOLOM_ANAK } },
        },
      },
    }),
    prisma.company_settings.findUnique({ where: { id: BigInt(1) } }),
  ]);

  if (!p) return null;

  const ttd = await tandaTanganDokumen({
    idPenandatangan: p.signatory_id,
    namaCadangan: perusahaan?.signature_name ?? null,
    jalurCadangan: perusahaan?.signature_path ?? null,
  });

  return {
    judul: "Quotation",
    labelNomor: "No. Quotation",
    nomor: p.quotation_number,
    tanggal: p.quotation_date,
    labelTanggalKedua: "Berlaku s/d",
    tanggalKedua: p.valid_until,

    pelanggan: { nama: p.customers.name, alamat: p.customers.address },
    kontak: { nama: p.contact_person, telepon: p.contact_phone },

    acara: {
      tanggal: p.quotation_event_dates.map((b) => b.event_date),
      tamu: p.guest_count,
      planner: p.fnb_planner,
      jam: p.event_time,
      venue: p.venue,
      jenis: p.event_type,
    },

    baris: p.quotation_items.map((b) => susunBaris(b, b.other_quotation_items)),

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
      signature_url: ttd.tautan,
      signature_name: ttd.nama,
      bank_name: perusahaan?.bank_name ?? null,
      bank_account_number: perusahaan?.bank_account_number ?? null,
      bank_account_holder: perusahaan?.bank_account_holder ?? null,
      bank_code: perusahaan?.bank_code ?? null,
      swift_code: perusahaan?.swift_code ?? null,
    },
  };
}
