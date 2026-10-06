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

/* --------------------------------------------------------------------------
   MENGUBAH DAN MENGHAPUS

   Aturannya ditaruh di sini, bukan di dalam server action, supaya bisa
   diuji tanpa sesi — penjaga peran tetap di actionsnya.
   -------------------------------------------------------------------------- */

/** Berapa dokumen yang memilih penandatangan ini. */
export async function jumlahDokumenPenandatangan(id: bigint): Promise<number> {
  const [penawaran, tagihan] = await Promise.all([
    prisma.quotations.count({ where: { signatory_id: id } }),
    prisma.invoices.count({ where: { signatory_id: id } }),
  ]);

  return penawaran + tagihan;
}

export type IzinHapus = { boleh: true } | { boleh: false; alasan: string };

/**
 * Apakah satu penandatangan boleh dihapus permanen.
 *
 * DUA HAL YANG MENAHANNYA, dan keduanya tidak menimbulkan galat apa pun
 * kalau dilanggar — yang berubah hanya nama di bawah tanda tangan, dan itu
 * baru ketahuan setelah dokumennya sampai ke customer:
 *
 * 1. ADA DOKUMEN YANG MEMAKAINYA. Kolomnya ON DELETE SET NULL, jadi
 *    menghapusnya tidak merusak apa-apa — dokumen lamanya justru diam-diam
 *    berpindah ke penandatangan aktif yang pertama. Dokumen yang sudah
 *    dikirim ke customer tidak boleh berubah tanda tangannya. Untuk orang
 *    yang pindah kerja, Nonaktifkan memang jawabannya.
 *
 * 2. INI SATU-SATUNYA YANG AKTIF. Dokumen baru akan terbit tanpa nama sama
 *    sekali, dan tidak ada tanda apa pun bahwa itu terjadi.
 *
 * Baris yang belum pernah dipakai — salah ketik, atau tertambah dua kali —
 * tidak tertahan apa pun, dan memang itu yang perlu bisa dihapus.
 */
export async function bolehHapusPenandatangan(id: bigint): Promise<IzinHapus> {
  const baris = await prisma.signatories.findUnique({
    where: { id },
    select: { name: true, is_active: true },
  });

  if (!baris) return { boleh: false, alasan: "Penandatangan ini sudah tidak ada." };

  const dipakai = await jumlahDokumenPenandatangan(id);
  if (dipakai > 0) {
    return {
      boleh: false,
      alasan:
        `${baris.name} dipakai ${dipakai} dokumen yang sudah terbit. Menghapusnya akan ` +
        "mengubah tanda tangan di dokumen itu. Pakai Nonaktifkan: ia hilang dari pilihan " +
        "dokumen baru, tetapi tetap tercetak di dokumen lamanya.",
    };
  }

  if (baris.is_active) {
    const aktifLain = await prisma.signatories.count({
      where: { is_active: true, id: { not: id } },
    });
    if (aktifLain === 0) {
      return {
        boleh: false,
        alasan:
          "Ini satu-satunya penandatangan yang aktif. Tambahkan penggantinya dulu, " +
          "supaya dokumen baru tidak terbit tanpa nama.",
      };
    }
  }

  return { boleh: true };
}
