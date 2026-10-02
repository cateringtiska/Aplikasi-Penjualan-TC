"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   TINDAKAN PADA TAGIHAN

   Tagihan tidak punya alur persetujuan seperti penawaran. Yang ada hanya
   status pembayaran, dan itu dihitung dari pembayaran yang masuk — bukan
   diubah manual. Satu-satunya perubahan status yang dilakukan orang adalah
   pembatalan.
   ========================================================================== */

export async function batalkanTagihan(id: string): Promise<void> {
  await pastikanPeran("finance");

  const tagihan = await prisma.invoices.findUnique({
    where: { id: BigInt(id) },
    select: { paid_amount: true, status: true },
  });
  if (!tagihan) throw new Error("Invoice tidak ditemukan.");

  if (Number(tagihan.paid_amount) > 0) {
    throw new Error(
      "Invoice yang sudah menerima payment tidak bisa dibatalkan. Hapus payment-nya lebih dulu.",
    );
  }

  await prisma.invoices.update({
    where: { id: BigInt(id) },
    data: { status: "cancelled", updated_at: new Date() },
  });

  revalidatePath("/tagihan");
  revalidatePath(`/tagihan/${id}`);
}

export async function hapusTagihan(id: string): Promise<void> {
  await pastikanPeran("finance");

  const tagihan = await prisma.invoices.findUnique({
    where: { id: BigInt(id) },
    select: {
      paid_amount: true,
      payment_details: { take: 1, select: { id: true } },
      invoice_margins: { select: { status: true } },
    },
  });
  if (!tagihan) return;

  if (Number(tagihan.paid_amount) > 0 || tagihan.payment_details.length > 0) {
    throw new Error("Invoice ini sudah punya catatan payment, jadi tidak bisa dihapus.");
  }
  if (tagihan.invoice_margins?.status === "final") {
    throw new Error("Margin invoice ini sudah difinalisasi, jadi tidak bisa dihapus.");
  }

  // Baris item, biaya, dan margin ikut terhapus lewat aturan cascade.
  await prisma.invoices.delete({ where: { id: BigInt(id) } });

  revalidatePath("/tagihan");
}

/**
 * Menandai tagihan yang sudah lewat jatuh tempo.
 *
 * Hanya menyentuh yang belum lunas dan belum dibatalkan. Dijalankan saat
 * daftar dibuka, supaya status di layar tidak pernah bertentangan dengan
 * tanggalnya.
 */
export async function tandaiJatuhTempo(): Promise<void> {
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  await prisma.invoices.updateMany({
    where: { status: { in: ["unpaid", "partial"] }, due_date: { lt: hariIni } },
    data: { status: "overdue" },
  });
}
