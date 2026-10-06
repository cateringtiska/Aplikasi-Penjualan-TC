"use server";

import { revalidatePath } from "next/cache";

import { unggahTandaTangan } from "@/lib/penyimpanan";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   MENGELOLA PENANDATANGAN

   Marketing ada dua orang, dan tiap dokumen ditandatangani salah satunya.

   TIDAK ADA PENGHAPUSAN, hanya penonaktifan. Dokumen yang sudah terbit
   menunjuk ke barisnya; menghapusnya membuat dokumen lama kehilangan tanda
   tangannya — dan dokumen yang sudah dikirim ke customer tidak boleh berubah
   karena orangnya pindah kerja. Yang nonaktif hilang dari pilihan dokumen
   baru, dan tetap tercetak di dokumen lamanya.
   ========================================================================== */

export type KeadaanPenandatangan = { pesan?: string; galat?: string };

export async function tambahPenandatangan(
  _sebelumnya: KeadaanPenandatangan,
  data: FormData,
): Promise<KeadaanPenandatangan> {
  await pastikanPeran(); // Admin saja.

  const nama = String(data.get("nama") ?? "").trim();
  if (nama.length < 2) return { galat: "Nama penandatangan belum diisi." };
  if (nama.length > 255) return { galat: "Nama terlalu panjang." };

  // Tanda tangan boleh menyusul: orangnya sudah ada, gambarnya belum tentu.
  let jalur: string | null = null;
  const berkas = data.get("tanda_tangan");

  if (berkas instanceof File && berkas.size > 0) {
    const unggah = await unggahTandaTangan(berkas);
    if (!unggah.ok) return { galat: unggah.pesan };
    jalur = unggah.jalur;
  }

  const terakhir = await prisma.signatories.findFirst({
    orderBy: { sort_order: "desc" },
    select: { sort_order: true },
  });

  await prisma.signatories.create({
    data: {
      name: nama,
      signature_path: jalur,
      is_active: true,
      sort_order: (terakhir?.sort_order ?? 0) + 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  revalidatePath("/perusahaan");
  return { pesan: `${nama} ditambahkan.` };
}

export async function ubahAktifPenandatangan(id: string, aktif: boolean): Promise<void> {
  await pastikanPeran();

  if (!aktif) {
    // Satu-satunya penandatangan aktif tidak boleh dimatikan: dokumen baru
    // akan terbit tanpa nama sama sekali, dan tidak ada tanda apa pun bahwa
    // itu terjadi sampai ada yang membaca cetakannya.
    const aktifLain = await prisma.signatories.count({
      where: { is_active: true, id: { not: BigInt(id) } },
    });
    if (aktifLain === 0) {
      throw new Error(
        "Ini satu-satunya penandatangan aktif. Tambahkan penggantinya dulu sebelum menonaktifkannya.",
      );
    }
  }

  await prisma.signatories.update({
    where: { id: BigInt(id) },
    data: { is_active: aktif, updated_at: new Date() },
  });

  revalidatePath("/perusahaan");
}
