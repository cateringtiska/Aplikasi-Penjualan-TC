import "server-only";

import type { PilihanPelanggan, PilihanProduk } from "@/components/form-dokumen";

import { prisma } from "./prisma";

/** Daftar pilihan untuk formulir penawaran dan tagihan. Hanya yang aktif. */
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

/** Tanggal dalam bentuk yang dipahami input type="date". */
export function hariIni(tambahHari = 0): string {
  const t = new Date();
  t.setDate(t.getDate() + tambahHari);
  return t.toISOString().slice(0, 10);
}

export function tanggalUntukInput(nilai: Date | null): string {
  return nilai ? nilai.toISOString().slice(0, 10) : "";
}

/**
 * Menyiapkan daftar tanggal acara untuk formulir.
 *
 * Dokumen yang dibuat SEBELUM tanggal acara menjadi daftar hanya punya satu
 * kolom tanggal dan satu kolom jumlah hari. Membuka dokumen itu dengan
 * daftar kosong lalu menyimpannya akan MENGHAPUS tanggal acaranya — tanpa
 * peringatan, karena memang tidak ada yang salah menurut aturan barunya.
 *
 * Jadi daftar yang kosong diisi dari kolom lamanya: satu tanggal untuk acara
 * sehari, dan berurutan sebanyak jumlah harinya untuk acara yang lebih
 * panjang. Itu pembacaan yang setia atas arti kedua kolom itu.
 */
export function tanggalAcaraUntukFormulir(
  daftar: { event_date: Date }[],
  cadanganTanggal: Date | null,
  cadanganHari: number | null,
): string[] {
  if (daftar.length > 0) return daftar.map((b) => tanggalUntukInput(b.event_date));
  if (!cadanganTanggal) return [];

  const hari = Math.max(1, Math.min(cadanganHari ?? 1, 31));
  return Array.from({ length: hari }, (_, i) => {
    const t = new Date(cadanganTanggal);
    t.setUTCDate(t.getUTCDate() + i);
    return tanggalUntukInput(t);
  });
}
