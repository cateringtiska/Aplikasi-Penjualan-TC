"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BATAS_KETERANGAN } from "@/lib/batas";
import { kodeProdukBerikutnya, simpanDenganKodeUnik } from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanIzin } from "@/lib/rbac";
import { uraikanRupiah } from "@/lib/uang";

const kosongJadiNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const skema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(3, "Nama minimal 3 huruf.").max(255),
  type: z.enum(["barang", "jasa"], { message: "Pilih barang atau jasa." }),
  unit: z.string().trim().min(1, "Satuan belum diisi.").max(20, "Maksimal 20 karakter."),
  description: z.preprocess(kosongJadiNull, z.string().trim().max(BATAS_KETERANGAN).nullable()),
});

export type KeadaanProduk = {
  sukses?: boolean;
  pesan?: string;
  galat?: Partial<Record<"name" | "type" | "unit" | "default_price" | "description", string>>;
};

export async function simpanProduk(
  _sebelumnya: KeadaanProduk,
  data: FormData,
): Promise<KeadaanProduk> {
  const sesi = await pastikanIzin("produk");

  const hasil = skema.safeParse(Object.fromEntries(data));

  // Harga diurai terpisah karena aturannya khas Indonesia: titik adalah
  // pemisah ribuan. Kalau dibiarkan ke Number(), "85.000" jadi 85.
  const harga = uraikanRupiah(data.get("default_price"));

  if (!hasil.success || harga === null || harga.isNegative()) {
    const bidang = hasil.success ? {} : z.flattenError(hasil.error).fieldErrors;
    return {
      galat: {
        ...(Object.fromEntries(
          Object.entries(bidang).map(([k, v]) => [k, v?.[0]]),
        ) as KeadaanProduk["galat"]),
        ...(harga === null
          ? { default_price: "Isi angka saja, contoh: 85.000" }
          : harga.isNegative()
            ? { default_price: "Harga tidak boleh minus." }
            : {}),
      },
    };
  }

  const { id, ...isi } = hasil.data;

  try {
    if (id) {
      await prisma.products.update({
        where: { id: BigInt(id) },
        data: { ...isi, default_price: harga.toFixed(2), updated_at: new Date() },
      });
    } else {
      await simpanDenganKodeUnik(kodeProdukBerikutnya, (kode) =>
        prisma.products.create({
          data: {
            ...isi,
            default_price: harga.toFixed(2),
            product_code: kode,
            status: "active",
            created_by: BigInt(sesi.id),
            created_at: new Date(),
            updated_at: new Date(),
          },
        }),
      );
    }
  } catch {
    return { pesan: "Data gagal disimpan. Coba lagi sebentar." };
  }

  revalidatePath("/produk");
  return { sukses: true, pesan: id ? "Data product diperbarui." : "Product baru ditambahkan." };
}

export async function ubahStatusProduk(id: string): Promise<void> {
  await pastikanIzin("produk");

  const produk = await prisma.products.findUnique({
    where: { id: BigInt(id) },
    select: { status: true },
  });
  if (!produk) return;

  await prisma.products.update({
    where: { id: BigInt(id) },
    data: {
      status: produk.status === "active" ? "inactive" : "active",
      updated_at: new Date(),
    },
  });

  revalidatePath("/produk");
}
