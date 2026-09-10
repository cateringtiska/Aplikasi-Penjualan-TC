"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BATAS_KETERANGAN } from "@/lib/batas";
import { kodePelangganBerikutnya, simpanDenganKodeUnik } from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

const kosongJadiNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const skema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(3, "Nama minimal 3 huruf.").max(255),
  address: z.preprocess(kosongJadiNull, z.string().trim().max(BATAS_KETERANGAN).nullable()),
  phone: z.preprocess(kosongJadiNull, z.string().trim().max(20, "Maksimal 20 karakter.").nullable()),
  email: z.preprocess(kosongJadiNull, z.email("Format email belum benar.").nullable()),
  npwp: z.preprocess(kosongJadiNull, z.string().trim().max(30).nullable()),
  pic_name: z.preprocess(kosongJadiNull, z.string().trim().max(100).nullable()),
});

export type KeadaanPelanggan = {
  sukses?: boolean;
  pesan?: string;
  galat?: Partial<Record<"name" | "address" | "phone" | "email" | "npwp" | "pic_name", string>>;
};

export async function simpanPelanggan(
  _sebelumnya: KeadaanPelanggan,
  data: FormData,
): Promise<KeadaanPelanggan> {
  const sesi = await pastikanPeran("sales", "finance");

  const hasil = skema.safeParse(Object.fromEntries(data));

  if (!hasil.success) {
    const bidang = z.flattenError(hasil.error).fieldErrors;
    return {
      galat: Object.fromEntries(
        Object.entries(bidang).map(([k, v]) => [k, v?.[0]]),
      ) as KeadaanPelanggan["galat"],
    };
  }

  const { id, ...isi } = hasil.data;

  try {
    if (id) {
      await prisma.customers.update({
        where: { id: BigInt(id) },
        data: { ...isi, updated_at: new Date() },
      });
    } else {
      await simpanDenganKodeUnik(kodePelangganBerikutnya, (kode) =>
        prisma.customers.create({
          data: {
            ...isi,
            customer_code: kode,
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

  revalidatePath("/pelanggan");
  return {
    sukses: true,
    pesan: id ? "Data pelanggan diperbarui." : "Pelanggan baru ditambahkan.",
  };
}

export async function ubahStatusPelanggan(id: string): Promise<void> {
  await pastikanPeran("sales", "finance");

  const pelanggan = await prisma.customers.findUnique({
    where: { id: BigInt(id) },
    select: { status: true },
  });
  if (!pelanggan) return;

  await prisma.customers.update({
    where: { id: BigInt(id) },
    data: {
      status: pelanggan.status === "active" ? "inactive" : "active",
      updated_at: new Date(),
    },
  });

  revalidatePath("/pelanggan");
}
