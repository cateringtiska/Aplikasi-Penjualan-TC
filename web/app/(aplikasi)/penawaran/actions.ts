"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   PERUBAHAN STATUS PENAWARAN

   Alur statusnya: draft -> terkirim -> disetujui / ditolak.
   Kadaluarsa terjadi sendiri ketika tanggal berlaku lewat.

   Penawaran hanya boleh dihapus selagi masih draft. Begitu terkirim ke
   pelanggan, ia menjadi catatan yang tidak boleh hilang diam-diam —
   aturan ini dibawa apa adanya dari Laravel.
   ========================================================================== */

const BOLEH_DIUBAH: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["approved", "rejected"],
  expired: ["sent"],
  rejected: ["sent"],
  approved: [],
};

export async function ubahStatusPenawaran(id: string, tujuan: string): Promise<void> {
  const sesi = await pastikanPeran("sales", "finance");

  // Penyaringnya ikut ke dalam pencarian, bukan diperiksa sesudahnya. Sales
  // tidak pernah melihat quotation orang lain di layar, tetapi tindakan ini
  // dipanggil dengan nomor — dan nomor bisa diketik sendiri.
  const penawaran = await prisma.quotations.findFirst({
    where: { id: BigInt(id), ...hanyaMiliknya(sesi) },
    select: { status: true },
  });
  if (!penawaran) throw new Error("Quotation tidak ditemukan.");

  if (!BOLEH_DIUBAH[penawaran.status]?.includes(tujuan)) {
    throw new Error("Perubahan status itu tidak diizinkan dari keadaan sekarang.");
  }

  await prisma.quotations.update({
    where: { id: BigInt(id) },
    data: { status: tujuan, updated_at: new Date() },
  });

  revalidatePath("/penawaran");
  revalidatePath(`/penawaran/${id}`);
}

export async function hapusPenawaran(id: string): Promise<void> {
  const sesi = await pastikanPeran("sales", "finance");

  const penawaran = await prisma.quotations.findFirst({
    where: { id: BigInt(id), ...hanyaMiliknya(sesi) },
    select: { status: true, invoices: { take: 1, select: { id: true } } },
  });
  if (!penawaran) return;

  if (penawaran.status !== "draft") {
    throw new Error("Hanya quotation berstatus draft yang bisa dihapus.");
  }
  if (penawaran.invoices.length > 0) {
    throw new Error("Quotation ini sudah dijadikan invoice, jadi tidak bisa dihapus.");
  }

  // Baris item ikut terhapus otomatis lewat aturan cascade di database.
  await prisma.quotations.delete({ where: { id: BigInt(id) } });

  revalidatePath("/penawaran");
}

/**
 * Menandai penawaran yang masa berlakunya sudah lewat.
 *
 * Dijalankan sekali saat daftar dibuka. Kalau tidak ada yang perlu diubah,
 * biayanya hanya satu kueri yang tidak mengubah baris apa pun — jauh lebih
 * murah daripada membiarkan status salah dan tersaring keliru di laporan.
 */
export async function tandaiKadaluarsa(): Promise<void> {
  const kemarin = new Date();
  kemarin.setHours(0, 0, 0, 0);

  await prisma.quotations.updateMany({
    where: { status: "sent", valid_until: { lt: kemarin } },
    data: { status: "expired" },
  });
}
