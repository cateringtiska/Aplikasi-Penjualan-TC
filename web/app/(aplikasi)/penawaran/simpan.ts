"use server";

import type { Decimal } from "decimal.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { nomorPenawaranBerikutnya, simpanDenganKodeUnik } from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";
import { d, hitungTotalDokumen, uraikanRupiah } from "@/lib/uang";

/* ==========================================================================
   MENYIMPAN PENAWARAN

   Dua hal yang sengaja dikerjakan berbeda dari Laravel:

   1. SELURUH PENYIMPANAN DIBUNGKUS SATU TRANSAKSI.
      Laravel menghapus semua baris item lalu membuatnya kembali satu per
      satu tanpa pengaman. Kalau putus di tengah, hasilnya penawaran dengan
      total sudah diperbarui tetapi tanpa satu baris item pun — dan itu tidak
      bisa dipulihkan sendiri. Di sini, gagal di tengah berarti tidak ada
      yang berubah sama sekali.

   2. TOTAL DIHITUNG ULANG DI SERVER.
      Angka yang dikirim browser hanya dipakai untuk ditampilkan. Yang
      disimpan selalu hasil hitungan server, memakai rumus yang sama yang
      sudah dikunci tes di lib/uang.ts.
   ========================================================================== */

const barisAnak = z.object({
  item_name: z.string().trim().max(255),
});

const barisItem = z.object({
  product_id: z.string().trim().nullable().optional(),
  item_name: z.string().trim().min(1, "Nama item belum diisi.").max(255),
  unit: z.string().trim().max(255).nullable().optional(),
  qty: z.string(),
  price: z.string(),
  is_compliment: z.boolean().default(false),
  charge_service: z.boolean().default(true),
  children: z.array(barisAnak).default([]),
});

const skema = z.object({
  id: z.string().trim().optional().nullable(),
  customer_id: z.string().trim().min(1, "Pelanggan belum dipilih."),
  contact_person: z.string().trim().max(255).nullable().optional(),
  contact_phone: z.string().trim().max(255).nullable().optional(),
  quotation_date: z.string().min(1, "Tanggal penawaran belum diisi."),
  valid_until: z.string().min(1, "Tanggal berlaku belum diisi."),
  event_date: z.string().nullable().optional(),
  event_days: z.string().nullable().optional(),
  event_type: z.string().trim().max(255).nullable().optional(),
  event_time: z.string().trim().max(255).nullable().optional(),
  guest_count: z.string().nullable().optional(),
  fnb_planner: z.string().trim().max(255).nullable().optional(),
  venue: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  service_charge_percent: z.string().nullable().optional(),
  pb1_enabled: z.boolean().default(false),
  pb1_percent: z.string().nullable().optional(),
  show_payment_terms: z.boolean().default(false),
  payment_terms: z.string().trim().max(5000).nullable().optional(),
  items: z.array(barisItem).min(1, "Tambahkan minimal satu item."),
});

export type KeadaanPenawaran = {
  pesan?: string;
  galat?: Record<string, string>;
};

/** Satu baris yang angkanya sudah diurai menjadi Decimal dan siap disimpan. */
type BarisSiap = z.infer<typeof barisItem> & { qtyD: Decimal; priceD: Decimal };

function angkaBulat(teks: unknown): number | null {
  const nilai = uraikanRupiah(teks);
  if (nilai === null) return null;
  const bulat = nilai.toNumber();
  return Number.isFinite(bulat) ? Math.trunc(bulat) : null;
}

export async function simpanPenawaran(
  _sebelumnya: KeadaanPenawaran,
  data: FormData,
): Promise<KeadaanPenawaran> {
  const sesi = await pastikanPeran("sales", "finance");

  let mentah: unknown;
  try {
    mentah = JSON.parse(String(data.get("muatan") ?? ""));
  } catch {
    return { pesan: "Data formulir rusak. Muat ulang halaman lalu coba lagi." };
  }

  const hasil = skema.safeParse(mentah);
  if (!hasil.success) {
    const bidang = z.flattenError(hasil.error);
    const galat: Record<string, string> = {};
    for (const [kunci, pesan] of Object.entries(bidang.fieldErrors)) {
      if (pesan?.[0]) galat[kunci] = pesan[0];
    }
    return {
      galat,
      pesan: bidang.formErrors[0] ?? "Ada isian yang belum benar. Periksa tanda merah.",
    };
  }

  const f = hasil.data;

  // Validasi angka pada setiap baris — dikerjakan di sini, bukan di zod,
  // supaya pesannya bisa menyebut baris ke berapa.
  const items: BarisSiap[] = [];
  for (const [i, baris] of f.items.entries()) {
    const qty = uraikanRupiah(baris.qty);
    const price = uraikanRupiah(baris.price);

    if (qty === null || qty.lte(0)) {
      return { galat: { items: `Baris ${i + 1}: jumlah harus lebih dari nol.` } };
    }
    if (price === null || price.isNegative()) {
      return { galat: { items: `Baris ${i + 1}: harga tidak boleh minus.` } };
    }

    items.push({ ...baris, qtyD: qty, priceD: price });
  }

  if (new Date(f.valid_until) < new Date(f.quotation_date)) {
    return { galat: { valid_until: "Tanggal berlaku tidak boleh sebelum tanggal penawaran." } };
  }

  const total = hitungTotalDokumen({
    items: items.map((b) => ({
      qty: b.qtyD,
      price: b.priceD,
      is_compliment: b.is_compliment,
      charge_service: b.charge_service,
    })),
    service_charge_percent: f.service_charge_percent ?? null,
    pb1_enabled: f.pb1_enabled,
    pb1_percent: f.pb1_percent ?? 10,
  });

  const isi = {
    customer_id: BigInt(f.customer_id),
    contact_person: f.contact_person || null,
    contact_phone: f.contact_phone || null,
    quotation_date: new Date(f.quotation_date),
    valid_until: new Date(f.valid_until),
    event_date: f.event_date ? new Date(f.event_date) : null,
    event_days: angkaBulat(f.event_days),
    event_type: f.event_type || null,
    event_time: f.event_time || null,
    guest_count: angkaBulat(f.guest_count),
    fnb_planner: f.fnb_planner || null,
    venue: f.venue || null,
    notes: f.notes || null,
    subtotal: total.subtotal.toFixed(2),
    service_charge_percent: f.service_charge_percent
      ? d(f.service_charge_percent).toFixed(2)
      : null,
    service_charge_amount: total.service_charge_amount.toFixed(2),
    pb1_enabled: f.pb1_enabled,
    pb1_percent: f.pb1_enabled ? d(f.pb1_percent ?? 10).toFixed(2) : null,
    pb1_amount: total.pb1_amount.toFixed(2),
    grand_total: total.grand_total.toFixed(2),
    show_payment_terms: f.show_payment_terms,
    payment_terms: f.show_payment_terms ? f.payment_terms || null : null,
    updated_at: new Date(),
  };

  function barisUntukDisimpan(idPenawaran: bigint) {
    return items.map((b) => ({
      induk: {
        quotation_id: idPenawaran,
        product_id: b.product_id ? BigInt(b.product_id) : null,
        item_name: b.item_name,
        unit: b.unit || null,
        qty: b.qtyD.toFixed(2),
        price: b.priceD.toFixed(2),
        subtotal: (b.is_compliment ? d(0) : b.qtyD.times(b.priceD)).toFixed(2),
        is_compliment: b.is_compliment,
        charge_service: b.charge_service,
        created_at: new Date(),
        updated_at: new Date(),
      },
      anak: b.children
        .map((a) => a.item_name.trim())
        .filter((nama) => nama !== ""),
    }));
  }

  let idHasil: string;

  try {
    idHasil = await prisma.$transaction(async (tx) => {
      let idPenawaran: bigint;

      if (f.id) {
        const ada = await tx.quotations.findUnique({
          where: { id: BigInt(f.id) },
          select: { status: true },
        });
        if (!ada) throw new Error("Penawaran tidak ditemukan.");
        if (ada.status === "approved") {
          throw new Error("Penawaran yang sudah disetujui tidak bisa diubah lagi.");
        }

        await tx.quotations.update({ where: { id: BigInt(f.id) }, data: isi });
        await tx.quotation_items.deleteMany({ where: { quotation_id: BigInt(f.id) } });
        idPenawaran = BigInt(f.id);
      } else {
        const baru = await simpanDenganKodeUnik(nomorPenawaranBerikutnya, (nomor) =>
          tx.quotations.create({
            data: {
              ...isi,
              quotation_number: nomor,
              status: "draft",
              created_by: BigInt(sesi.id),
              created_at: new Date(),
            },
            select: { id: true },
          }),
        );
        idPenawaran = baru.id;
      }

      for (const { induk, anak } of barisUntukDisimpan(idPenawaran)) {
        const barisInduk = await tx.quotation_items.create({
          data: induk,
          select: { id: true },
        });

        if (anak.length > 0) {
          await tx.quotation_items.createMany({
            data: anak.map((nama) => ({
              quotation_id: idPenawaran,
              parent_id: barisInduk.id,
              item_name: nama,
              unit: null,
              qty: "0",
              price: "0",
              subtotal: "0",
              is_compliment: false,
              charge_service: false,
              created_at: new Date(),
              updated_at: new Date(),
            })),
          });
        }
      }

      return idPenawaran.toString();
    });
  } catch (galat) {
    return {
      pesan:
        galat instanceof Error && galat.message.length < 200
          ? galat.message
          : "Penawaran gagal disimpan. Tidak ada data yang berubah.",
    };
  }

  revalidatePath("/penawaran");
  revalidatePath(`/penawaran/${idHasil}`);
  redirect(`/penawaran/${idHasil}?tersimpan=1`);
}
