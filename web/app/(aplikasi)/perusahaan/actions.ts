"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BATAS_SYARAT } from "@/lib/batas";
import { hapusGambar, unggahGambar } from "@/lib/penyimpanan";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

const kosongJadiNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const skema = z.object({
  company_name: z.string().trim().min(2, "Nama perusahaan belum diisi.").max(255),
  signature_name: z.preprocess(kosongJadiNull, z.string().trim().max(255).nullable()),
  bank_name: z.preprocess(kosongJadiNull, z.string().trim().max(255).nullable()),
  bank_account_number: z.preprocess(kosongJadiNull, z.string().trim().max(255).nullable()),
  bank_account_holder: z.preprocess(kosongJadiNull, z.string().trim().max(255).nullable()),
  payment_terms_default: z.preprocess(kosongJadiNull, z.string().trim().max(BATAS_SYARAT).nullable()),
  quotation_terms_default: z.preprocess(kosongJadiNull, z.string().trim().max(BATAS_SYARAT).nullable()),
});

export type KeadaanPerusahaan = {
  sukses?: boolean;
  pesan?: string;
  galat?: Record<string, string>;
};

export async function simpanPerusahaan(
  _sebelumnya: KeadaanPerusahaan,
  data: FormData,
): Promise<KeadaanPerusahaan> {
  await pastikanPeran();

  const hasil = skema.safeParse(Object.fromEntries(data));
  if (!hasil.success) {
    const bidang = z.flattenError(hasil.error).fieldErrors;
    return {
      galat: Object.fromEntries(
        Object.entries(bidang).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }

  const sekarang = await prisma.company_settings.findUnique({
    where: { id: BigInt(1) },
    select: { logo_path: true, signature_path: true },
  });

  const perubahan: Record<string, string | null> = { ...hasil.data };

  // Gambar diunggah lebih dulu. Kalau salah satunya gagal, pengaturan teks
  // pun tidak jadi disimpan — supaya keadaan yang tersimpan tidak setengah.
  for (const [medan, kolom, awalan] of [
    ["logo", "logo_path", "logo"],
    ["signature", "signature_path", "tanda-tangan"],
  ] as const) {
    const berkas = data.get(medan);
    if (!(berkas instanceof File) || berkas.size === 0) continue;

    const unggah = await unggahGambar(berkas, awalan);
    if (!unggah.ok) return { galat: { [medan]: unggah.pesan } };

    perubahan[kolom] = unggah.tautan;
  }

  try {
    await prisma.company_settings.upsert({
      where: { id: BigInt(1) },
      create: {
        id: BigInt(1),
        company_name: hasil.data.company_name,
        ...perubahan,
        created_at: new Date(),
        updated_at: new Date(),
      },
      update: { ...perubahan, updated_at: new Date() },
    });
  } catch {
    return { pesan: "Pengaturan gagal disimpan." };
  }

  // Berkas lama baru dihapus setelah penggantinya benar-benar tersimpan.
  if (perubahan.logo_path && sekarang?.logo_path !== perubahan.logo_path) {
    await hapusGambar(sekarang?.logo_path ?? null);
  }
  if (perubahan.signature_path && sekarang?.signature_path !== perubahan.signature_path) {
    await hapusGambar(sekarang?.signature_path ?? null);
  }

  revalidatePath("/perusahaan");
  return { sukses: true, pesan: "Pengaturan perusahaan disimpan." };
}
