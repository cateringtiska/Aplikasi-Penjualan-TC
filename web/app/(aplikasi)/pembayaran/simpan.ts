"use server";

import type { Decimal } from "decimal.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { pesanGagal } from "@/lib/dokumen";
import { nomorDokumenBerikutnya, simpanDenganKodeUnik } from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";
import { d, hitungStatusInvoice, type StatusInvoice, uraikanRupiah } from "@/lib/uang";

/* ==========================================================================
   MENCATAT PEMBAYARAN

   Satu setoran bisa menutup beberapa tagihan sekaligus. Bagian yang paling
   mudah salah adalah alokasinya, jadi tiga aturan dijaga ketat:

   1. Jumlah seluruh alokasi harus SAMA PERSIS dengan uang yang diterima.
      Kalau tidak, ada rupiah yang menghilang atau muncul tanpa asal.
   2. Alokasi ke satu tagihan tidak boleh melebihi sisanya.
   3. Sisa tagihan dibaca ULANG di dalam transaksi, bukan dari yang dikirim
      browser. Selama halaman terbuka, orang lain bisa saja sudah mencatat
      pembayaran untuk tagihan yang sama.
   ========================================================================== */

const skema = z.object({
  customer_id: z.string().trim().min(1, "Customer belum dipilih."),
  payment_date: z.string().min(1, "Tanggal belum diisi."),
  payment_method: z.enum(["cash", "transfer", "giro", "lainnya"]),
  bank_cash: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  total_amount: z.string(),
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
  if (!totalAlokasi.equals(totalDiterima)) {
    return {
      galat: {
        alokasi: `Jumlah alokasi (${totalAlokasi.toFixed(0)}) harus sama persis dengan uang yang diterima (${totalDiterima.toFixed(0)}). Selisih ${totalDiterima.minus(totalAlokasi).abs().toFixed(0)}.`,
      },
    };
  }

  let idHasil: string;

  try {
    idHasil = await prisma.$transaction(async (tx) => {
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

      const pembayaran = await simpanDenganKodeUnik(
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
              notes: f.notes || null,
              created_by: BigInt(sesi.id),
              created_at: new Date(),
              updated_at: new Date(),
            },
            select: { id: true },
          }),
      );

      for (const a of alokasi) {
        await tx.payment_details.create({
          data: {
            payment_id: pembayaran.id,
            invoice_id: a.invoice_id,
            amount_applied: a.jumlah.toFixed(2),
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        await hitungUlangTagihan(tx, a.invoice_id);
      }

      return pembayaran.id.toString();
    });
  } catch (galat) {
    return pesanGagal(galat, "Pembayaran gagal disimpan. Tidak ada data yang berubah.");
  }

  revalidatePath("/pembayaran");
  revalidatePath("/tagihan");
  redirect(`/pembayaran/${idHasil}?tersimpan=1`);
}

/**
 * Menjumlah ulang seluruh alokasi yang masuk ke satu tagihan, lalu menetapkan
 * statusnya.
 *
 * Selalu dihitung dari nol berdasarkan baris payment_details yang ada —
 * tidak pernah menambah atau mengurangi angka yang tersimpan. Dengan begitu,
 * menghapus pembayaran juga otomatis benar.
 */
export async function hitungUlangTagihan(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  idTagihan: bigint,
): Promise<void> {
  const jumlah = await tx.payment_details.aggregate({
    where: { invoice_id: idTagihan },
    _sum: { amount_applied: true },
  });

  const tagihan = await tx.invoices.findUniqueOrThrow({
    where: { id: idTagihan },
    select: { status: true, grand_total: true, due_date: true },
  });

  const dibayar = d(jumlah._sum.amount_applied);

  await tx.invoices.update({
    where: { id: idTagihan },
    data: {
      paid_amount: dibayar.toFixed(2),
      status: hitungStatusInvoice({
        statusSekarang: tagihan.status as StatusInvoice,
        grandTotal: tagihan.grand_total.toString(),
        totalDibayar: dibayar,
        dueDate: tagihan.due_date,
      }),
      updated_at: new Date(),
    },
  });
}
