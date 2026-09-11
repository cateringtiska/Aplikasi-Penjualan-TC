import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { hitungMargin } from "./uang";

/* ==========================================================================
   RINGKASAN MARGIN TAGIHAN

   Tabel invoice_margins adalah RINGKASAN, bukan sumber kebenaran. Sumbernya
   baris-baris di invoice_costs. Ringkasan itu ada supaya laporan margin bisa
   membaca satu baris per tagihan, bukan menjumlah ulang seluruh biaya setiap
   kali halamannya dibuka.

   Karena ringkasan, ia hanya benar selama ikut diperbarui setiap kali
   biayanya berubah — termasuk ketika biaya masuk bukan lewat halaman margin,
   misalnya saat perkiraan biaya penawaran disalin ke tagihan baru. Tagihan
   yang biayanya ada tetapi ringkasannya nol akan terbaca 100% untung.
   ========================================================================== */

/**
 * Klien mana pun yang bisa menyentuh ketiga tabel ini — klien global maupun
 * klien transaksi.
 *
 * Kalau dipanggil DARI DALAM transaksi, `klien` wajib diisi `tx`. Kolam
 * koneksi hanya satu koneksi per salinan fungsi; kueri lewat klien global di
 * dalam transaksi akan mengantre menunggu koneksi yang dipegang transaksi itu
 * sendiri, sampai transaksinya kedaluwarsa. Lihat catatan panjang di
 * lib/nomor.ts — kegagalannya persis sama.
 */
export type KlienMargin = Pick<
  Prisma.TransactionClient,
  "invoices" | "invoice_costs" | "invoice_margins"
>;

/**
 * Menghitung ulang ringkasan margin satu tagihan dari seluruh baris biayanya.
 *
 * Selalu dihitung dari nol, tidak pernah menambah atau mengurangi angka yang
 * tersimpan — jadi menghapus baris biaya pun otomatis benar.
 */
export async function hitungUlangMargin(
  idTagihan: string | bigint,
  klien: KlienMargin = prisma,
): Promise<void> {
  const invoice_id = BigInt(idTagihan);

  const [tagihan, biaya] = await Promise.all([
    klien.invoices.findUniqueOrThrow({
      where: { id: invoice_id },
      select: { subtotal: true },
    }),
    klien.invoice_costs.findMany({
      where: { invoice_id },
      select: { estimated_amount: true, actual_amount: true },
    }),
  ]);

  const hasil = hitungMargin({
    subtotalInvoice: tagihan.subtotal.toString(),
    biaya: biaya.map((b) => ({
      estimated_amount: b.estimated_amount?.toString() ?? null,
      actual_amount: b.actual_amount?.toString() ?? null,
    })),
  });

  const angka = {
    net_sales: hasil.net_sales.toFixed(2),
    total_cost: hasil.total_cost.toFixed(2),
    profit: hasil.profit.toFixed(2),
    margin_percent: hasil.margin_percent.toFixed(2),
    profit_status: hasil.profit_status,
    updated_at: new Date(),
  };

  await klien.invoice_margins.upsert({
    where: { invoice_id },
    create: { invoice_id, ...angka, status: "draft", created_at: new Date() },
    update: angka,
  });
}

/** Klien yang sanggup menyalin perkiraan biaya penawaran ke tagihan. */
export type KlienSalin = KlienMargin & Pick<Prisma.TransactionClient, "quotation_costs">;

/**
 * Menyalin perkiraan biaya sebuah penawaran ke tagihan yang lahir darinya.
 *
 * Yang tersalin hanyalah ANGKA ESTIMASI. Biaya aktual milik acara yang
 * benar-benar sudah terjadi, dan tagihan yang baru terbit belum punya satu
 * pun angka nyata — menyalinnya akan membuat laporan mengaku tahu ongkos
 * yang sebenarnya belum pernah dihitung siapa pun.
 *
 * Ringkasan marginnya ikut diperbarui di sini. Tanpa itu, tagihan yang
 * biayanya sudah tersalin tetap terbaca untung 100% di laporan margin sampai
 * ada yang kebetulan membuka halaman marginnya dan mengubah sesuatu.
 *
 * Kalau dipanggil dari dalam transaksi, `klien` wajib diisi `tx`.
 */
export async function salinPerkiraanBiaya(
  idPenawaran: string | bigint,
  idTagihan: string | bigint,
  idPengguna: string | bigint,
  klien: KlienSalin = prisma,
): Promise<number> {
  const invoice_id = BigInt(idTagihan);

  const perkiraan = await klien.quotation_costs.findMany({
    where: { quotation_id: BigInt(idPenawaran) },
    orderBy: { id: "asc" },
    select: { category: true, description: true, estimated_amount: true, notes: true },
  });

  if (perkiraan.length > 0) {
    await klien.invoice_costs.createMany({
      data: perkiraan.map((b) => ({
        invoice_id,
        category: b.category,
        description: b.description,
        estimated_amount: b.estimated_amount,
        actual_amount: null,
        status: "estimasi",
        notes: b.notes,
        created_by: BigInt(idPengguna),
        created_at: new Date(),
        updated_at: new Date(),
      })),
    });

    await hitungUlangMargin(invoice_id, klien);
  }

  return perkiraan.length;
}
