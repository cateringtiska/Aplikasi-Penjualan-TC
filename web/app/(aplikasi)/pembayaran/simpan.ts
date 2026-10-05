"use server";

import type { Decimal } from "decimal.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { cocokkanAlokasi, lepasAlokasi, pasangAlokasi } from "@/lib/alokasi-pembayaran";
import { pesanGagal } from "@/lib/dokumen";
import { nomorDokumenBerikutnya, simpanDenganKodeUnik } from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";
import { d, uraikanRupiah } from "@/lib/uang";

/* ==========================================================================
   MENCATAT PEMBAYARAN

   Satu setoran bisa menutup beberapa tagihan sekaligus. Bagian yang paling
   mudah salah adalah alokasinya, jadi tiga aturan dijaga ketat:

   1. Jumlah seluruh alokasi harus SAMA PERSIS dengan uang yang diterima
      DITAMBAH PPh 23 yang dipotong. Kalau tidak, ada rupiah yang menghilang
      atau muncul tanpa asal.

      PPh 23 adalah 2% dari nilai jasa katering yang DITAHAN customer lalu
      disetorkannya ke kas negara atas nama perusahaan. Uang yang masuk ke
      rekening memang lebih kecil, tetapi invoicenya LUNAS: yang dipotong
      bukan hilang, melainkan sudah dibayarkan dan bisa dikreditkan dengan
      bukti potongnya. Mencatatnya sebagai kurang bayar akan membuat piutang
      yang tidak akan pernah bisa ditagih kepada siapa pun.
   2. Alokasi ke satu tagihan tidak boleh melebihi sisanya.
   3. Sisa tagihan dibaca ULANG di dalam transaksi, bukan dari yang dikirim
      browser. Selama halaman terbuka, orang lain bisa saja sudah mencatat
      pembayaran untuk tagihan yang sama.
   ========================================================================== */

const skema = z.object({
  /** Diisi hanya saat mengubah pembayaran yang sudah ada. */
  id: z.string().trim().nullable().optional(),
  customer_id: z.string().trim().min(1, "Customer belum dipilih."),
  payment_date: z.string().min(1, "Tanggal belum diisi."),
  payment_method: z.enum(["cash", "transfer", "giro", "lainnya"]),
  bank_cash: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  total_amount: z.string(),
  pph23_amount: z.string().nullable().optional(),
  pph23_bukti: z.string().trim().max(255).nullable().optional(),
  alokasi: z
    .array(z.object({ invoice_id: z.string(), jumlah: z.string() }))
    .min(1, "Pilih minimal satu invoice."),
});

export type KeadaanPembayaran = {
  pesan?: string;
  galat?: Record<string, string>;
};

export async function simpanPembayaran(
  _sebelumnya: KeadaanPembayaran,
  data: FormData,
): Promise<KeadaanPembayaran> {
  const sesi = await pastikanPeran("finance");

  let mentah: unknown;
  try {
    mentah = JSON.parse(String(data.get("muatan") ?? ""));
  } catch {
    return { pesan: "Data formulir rusak. Muat ulang halaman lalu coba lagi." };
  }

  const hasil = skema.safeParse(mentah);
  if (!hasil.success) {
    const rata = z.flattenError(hasil.error);
    const galat: Record<string, string> = {};
    for (const [kunci, pesan] of Object.entries(rata.fieldErrors)) {
      if (pesan?.[0]) galat[kunci] = pesan[0];
    }
    return { galat, pesan: rata.formErrors[0] ?? "Ada isian yang belum benar." };
  }

  const f = hasil.data;

  const totalDiterima = uraikanRupiah(f.total_amount);
  if (totalDiterima === null || totalDiterima.lte(0)) {
    return { galat: { total_amount: "Isi jumlah uang yang diterima." } };
  }

  const teksPph = String(f.pph23_amount ?? "").trim();
  const pph23 = teksPph === "" ? d(0) : uraikanRupiah(teksPph);
  if (pph23 === null || pph23.isNegative()) {
    return { galat: { pph23_amount: "Isi angka saja, dan tidak boleh minus." } };
  }

  const alokasi: { invoice_id: bigint; jumlah: Decimal }[] = [];
  for (const baris of f.alokasi) {
    const jumlah = uraikanRupiah(baris.jumlah);
    if (jumlah === null || jumlah.lte(0)) continue;
    alokasi.push({ invoice_id: BigInt(baris.invoice_id), jumlah });
  }

  if (alokasi.length === 0) {
    return { galat: { alokasi: "Isi jumlah alokasi pada minimal satu invoice." } };
  }

  const totalAlokasi = alokasi.reduce((jumlah, a) => jumlah.plus(a.jumlah), d(0));
  const tidakCocok = cocokkanAlokasi({ diterima: totalDiterima, pph23, totalAlokasi });
  if (tidakCocok) return { galat: { alokasi: tidakCocok } };

  let idHasil: string;

  try {
    idHasil = await prisma.$transaction(async (tx) => {
      // MENGUBAH PEMBAYARAN: alokasi lamanya dilepas LEBIH DULU, lalu tagihan
      // yang terdampak dihitung ulang. Tanpa itu, sisa yang dibaca di bawah
      // masih memuat uang dari pembayaran ini sendiri, dan menaikkan
      // alokasinya satu rupiah pun akan ditolak sebagai "melebihi sisa".
      if (f.id) {
        const ada = await tx.payments.findUnique({
          where: { id: BigInt(f.id) },
          select: { id: true },
        });
        if (!ada) throw new Error("Payment tidak ditemukan.");

        await lepasAlokasi(tx, BigInt(f.id));
      }

      // Sisa dibaca ulang di dalam transaksi — bukan dari yang dikirim browser.
      const tagihan = await tx.invoices.findMany({
        where: { id: { in: alokasi.map((a) => a.invoice_id) } },
        select: {
          id: true,
          invoice_number: true,
          customer_id: true,
          grand_total: true,
          paid_amount: true,
          due_date: true,
          status: true,
        },
      });

      for (const a of alokasi) {
        const t = tagihan.find((x) => x.id === a.invoice_id);
        if (!t) throw new Error("Ada invoice yang tidak ditemukan lagi.");
        if (t.customer_id.toString() !== f.customer_id) {
          throw new Error(`${t.invoice_number} bukan milik pelanggan yang dipilih.`);
        }
        if (t.status === "cancelled") {
          throw new Error(`${t.invoice_number} sudah dibatalkan.`);
        }

        const sisa = d(t.grand_total).minus(d(t.paid_amount));
        if (a.jumlah.gt(sisa)) {
          throw new Error(
            `Alokasi ke ${t.invoice_number} melebihi sisanya. Sisa sekarang ${sisa.toFixed(0)}.`,
          );
        }
      }

      // Nomor pembayaran TIDAK berubah saat diubah: ia sudah disebut di
      // kuitansi dan percakapan dengan customer.
      const pembayaran = f.id
        ? await tx.payments.update({
            where: { id: BigInt(f.id) },
            data: {
              payment_date: new Date(f.payment_date),
              customer_id: BigInt(f.customer_id),
              payment_method: f.payment_method,
              bank_cash: f.bank_cash || null,
              total_amount: totalDiterima.toFixed(2),
              pph23_amount: pph23.toFixed(2),
              pph23_bukti: f.pph23_bukti || null,
              notes: f.notes || null,
              updated_at: new Date(),
            },
            select: { id: true },
          })
        : await simpanDenganKodeUnik(
            () => nomorDokumenBerikutnya("payments", "payment_number", "PAY", tx),
            (nomor) =>
              tx.payments.create({
                data: {
                  payment_number: nomor,
                  payment_date: new Date(f.payment_date),
                  customer_id: BigInt(f.customer_id),
                  payment_method: f.payment_method,
                  bank_cash: f.bank_cash || null,
                  total_amount: totalDiterima.toFixed(2),
                  pph23_amount: pph23.toFixed(2),
                  pph23_bukti: f.pph23_bukti || null,
                  notes: f.notes || null,
                  created_by: BigInt(sesi.id),
                  created_at: new Date(),
                  updated_at: new Date(),
                },
                select: { id: true },
              }),
          );

      await pasangAlokasi(tx, pembayaran.id, alokasi);

      return pembayaran.id.toString();
    });
  } catch (galat) {
    return pesanGagal(galat, "Payment gagal disimpan. Tidak ada data yang berubah.");
  }

  revalidatePath("/pembayaran");
  revalidatePath("/tagihan");
  revalidatePath(`/pembayaran/${idHasil}`);
  redirect(`/pembayaran/${idHasil}?tersimpan=1`);
}

