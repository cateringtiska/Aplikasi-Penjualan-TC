"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

import { hitungUlangTagihan } from "./simpan";

/**
 * Menghapus pembayaran, lalu mengembalikan status tagihan yang terpengaruh.
 *
 * Seluruhnya satu transaksi. Di Laravel, penghapusan dan penghitungan ulang
 * dilakukan berurutan tanpa pengaman: putus di tengah menyisakan tagihan yang
 * mengaku lunas padahal uangnya sudah dihapus.
 */
export async function hapusPembayaran(id: string): Promise<void> {
  await pastikanPeran("finance");

  await prisma.$transaction(async (tx) => {
    const pembayaran = await tx.payments.findUnique({
      where: { id: BigInt(id) },
      select: { payment_details: { select: { invoice_id: true } } },
    });
    if (!pembayaran) return;

    const tagihanTerdampak = [
      ...new Set(pembayaran.payment_details.map((d) => d.invoice_id.toString())),
    ];

    await tx.payment_details.deleteMany({ where: { payment_id: BigInt(id) } });
    await tx.payments.delete({ where: { id: BigInt(id) } });

    for (const idTagihan of tagihanTerdampak) {
      await hitungUlangTagihan(tx, BigInt(idTagihan));
    }
  });

  revalidatePath("/pembayaran");
  revalidatePath("/tagihan");
}

/** Tagihan yang masih punya sisa, untuk satu pelanggan. */
export async function tagihanBelumLunas(idPelanggan: string) {
  await pastikanPeran("finance");

  const daftar = await prisma.invoices.findMany({
    where: {
      customer_id: BigInt(idPelanggan),
      status: { in: ["unpaid", "partial", "overdue"] },
    },
    orderBy: { due_date: "asc" },
    select: {
      id: true,
      invoice_number: true,
      due_date: true,
      grand_total: true,
      paid_amount: true,
      status: true,
    },
  });

  return daftar.map((t) => ({
    id: t.id.toString(),
    nomor: t.invoice_number,
    jatuhTempo: t.due_date.toISOString().slice(0, 10),
    total: t.grand_total.toString(),
    dibayar: t.paid_amount.toString(),
    sisa: t.grand_total.minus(t.paid_amount).toString(),
    status: t.status,
  }));
}
