import "server-only";

import { prisma } from "@/lib/prisma";

import type { PilihanPelanggan, PilihanProduk } from "./form-penawaran";

/** Daftar pilihan untuk formulir. Hanya yang berstatus aktif yang ditawarkan. */
export async function pilihanForm(): Promise<{
  pelanggan: PilihanPelanggan[];
  produk: PilihanProduk[];
}> {
  const [pelanggan, produk] = await Promise.all([
    prisma.customers.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customer_code: true, pic_name: true, phone: true },
    }),
    prisma.products.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, default_price: true },
    }),
  ]);

  return {
    pelanggan: pelanggan.map((p) => ({
      id: p.id.toString(),
      nama: p.name,
      kode: p.customer_code,
      contact_person: p.pic_name,
      phone: p.phone,
    })),
    produk: produk.map((p) => ({
      id: p.id.toString(),
      nama: p.name,
      unit: p.unit,
      harga: p.default_price.toString(),
    })),
  };
}

/** Tanggal hari ini dalam bentuk yang dipahami input type="date". */
export function hariIni(tambahHari = 0): string {
  const t = new Date();
  t.setDate(t.getDate() + tambahHari);
  return t.toISOString().slice(0, 10);
}

export function tanggalUntukInput(nilai: Date | null): string {
  return nilai ? nilai.toISOString().slice(0, 10) : "";
}
