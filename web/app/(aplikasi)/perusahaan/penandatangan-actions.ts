"use server";

import { revalidatePath } from "next/cache";

import {
  bolehHapusPenandatangan,
  jumlahDokumenPenandatangan,
} from "@/lib/penandatangan";
import { hapusTandaTangan, unggahTandaTangan } from "@/lib/penyimpanan";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   MENGELOLA PENANDATANGAN

   Marketing ada dua orang, dan tiap dokumen ditandatangani salah satunya.

   BARIS YANG SUDAH DIPAKAI DOKUMEN TIDAK BISA DIHAPUS, hanya dinonaktifkan.
   Dokumen yang sudah terbit menunjuk ke barisnya; menghapusnya akan
   memindahkan dokumen lama itu ke penandatangan lain tanpa suara — dan
   dokumen yang sudah dikirim ke customer tidak boleh berubah tanda
   tangannya karena orangnya pindah kerja. Yang nonaktif hilang dari pilihan
   dokumen baru, dan tetap tercetak di dokumen lamanya.

   Yang BELUM pernah dipakai — salah ketik, atau tertambah dua kali — boleh
   dihapus. Aturan lengkapnya di lib/penandatangan.ts.
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

export async function jejakPenandatangan(id: string): Promise<number> {
  await pastikanPeran();
  return jumlahDokumenPenandatangan(BigInt(id));
}

export async function ubahPenandatangan(
  _sebelumnya: KeadaanPenandatangan,
  data: FormData,
): Promise<KeadaanPenandatangan> {
  await pastikanPeran();

  const id = String(data.get("id") ?? "").trim();
  if (!/^d+$/.test(id)) return { galat: "Penandatangan tidak dikenali." };

  const nama = String(data.get("nama") ?? "").trim();
  if (nama.length < 2) return { galat: "Nama penandatangan belum diisi." };
  if (nama.length > 255) return { galat: "Nama terlalu panjang." };

  const sekarang = await prisma.signatories.findUnique({
    where: { id: BigInt(id) },
    select: { signature_path: true },
  });
  if (!sekarang) return { galat: "Penandatangan ini sudah tidak ada." };

  // Gambarnya hanya diganti kalau memang ada yang diunggah. Formulir yang
  // dikirim tanpa berkas berarti "namanya saja yang berubah" — bukan
  // "hapus tanda tangannya".
  let jalurBaru: string | null = null;
  const berkas = data.get("tanda_tangan");

  if (berkas instanceof File && berkas.size > 0) {
    const unggah = await unggahTandaTangan(berkas);
    if (!unggah.ok) return { galat: unggah.pesan };
    jalurBaru = unggah.jalur;
  }

  await prisma.signatories.update({
    where: { id: BigInt(id) },
    data: {
      name: nama,
      ...(jalurBaru ? { signature_path: jalurBaru } : {}),
      updated_at: new Date(),
    },
  });

  // Berkas lama baru dibuang setelah penggantinya benar-benar tersimpan.
  if (jalurBaru && sekarang.signature_path !== jalurBaru) {
    await hapusTandaTangan(sekarang.signature_path);
  }

  revalidatePath("/perusahaan");
  return { pesan: `${nama} diperbarui.` };
}

export async function hapusPenandatangan(id: string): Promise<void> {
  await pastikanPeran();

  const izin = await bolehHapusPenandatangan(BigInt(id));
  if (!izin.boleh) throw new Error(izin.alasan);

  const baris = await prisma.signatories.findUnique({
    where: { id: BigInt(id) },
    select: { signature_path: true },
  });

  await prisma.signatories.delete({ where: { id: BigInt(id) } });

  // Gambarnya menyusul, setelah barisnya benar-benar hilang. Urutan
  // sebaliknya akan meninggalkan baris yang menunjuk ke berkas yang sudah
  // tidak ada kalau penghapusannya gagal di tengah.
  await hapusTandaTangan(baris?.signature_path ?? null);

  revalidatePath("/perusahaan");
}
