import "server-only";

import { tautanTandaTangan } from "./penyimpanan";
import { prisma } from "./prisma";

/* ==========================================================================
   SIAPA YANG MENANDATANGANI DOKUMEN

   Marketing ada dua orang, dan tiap dokumen ditandatangani salah satunya.

   PENANDATANGAN TIDAK PERNAH DIHAPUS, hanya dinonaktifkan. Dokumen yang
   sudah terbit menunjuk ke barisnya; menghapusnya akan membuat dokumen lama
   kehilangan tanda tangannya — dan dokumen yang sudah dikirim ke customer
   tidak boleh berubah karena orangnya pindah kerja. Yang nonaktif hilang
   dari pilihan dokumen baru, tetapi tetap tercetak di dokumen lamanya.
   ========================================================================== */

export type PilihanPenandatangan = {
  id: string;
  nama: string;
  /** Jalur berkas di bucket tertutup. Belum berupa tautan. */
  jalurTtd: string | null;
};

/** Penandatangan yang boleh dipilih untuk dokumen baru. */
export async function penandatanganAktif(): Promise<PilihanPenandatangan[]> {
  const baris = await prisma.signatories.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    select: { id: true, name: true, signature_path: true },
  });

  return baris.map((b) => ({
    id: b.id.toString(),
    nama: b.name,
    jalurTtd: b.signature_path,
  }));
}

export type TandaTanganDokumen = {
  nama: string | null;
  /** Tautan bertanda waktu, siap dipasang di dokumen. */
  tautan: string | null;
};

/**
 * Tanda tangan yang dipakai satu dokumen.
 *
 * Urutan pencariannya menentukan, dan ketiganya diperlukan:
 *
 *   1. Penandatangan yang DIPILIH pada dokumen itu.
 *   2. Penandatangan aktif yang pertama, untuk dokumen yang dibuat sebelum
 *      pilihan ini ada.
 *   3. Kolom lama di pengaturan perusahaan, untuk keadaan yang tidak
 *      terduga — lebih baik dokumen tercetak dengan tanda tangan lama
 *      daripada terbit tanpa tanda tangan sama sekali.
 */
export async function tandaTanganDokumen(argumen: {
  idPenandatangan: bigint | null;
  namaCadangan: string | null;
  jalurCadangan: string | null;
}): Promise<TandaTanganDokumen> {
  if (argumen.idPenandatangan) {
    const dipilih = await prisma.signatories.findUnique({
      where: { id: argumen.idPenandatangan },
      select: { name: true, signature_path: true },
    });

    if (dipilih) {
      return {
        nama: dipilih.name,
        tautan: await tautanTandaTangan(dipilih.signature_path),
      };
    }
  }

  const pertama = await prisma.signatories.findFirst({
    where: { is_active: true },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    select: { name: true, signature_path: true },
  });

  if (pertama) {
    return { nama: pertama.name, tautan: await tautanTandaTangan(pertama.signature_path) };
  }

  return {
    nama: argumen.namaCadangan,
    tautan: await tautanTandaTangan(argumen.jalurCadangan),
  };
}
