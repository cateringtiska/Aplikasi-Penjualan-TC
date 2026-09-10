import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

/* ==========================================================================
   PENOMORAN DOKUMEN

   Aplikasi Laravel membuat nomor dengan cara mengambil baris terakhir lalu
   menambah satu pada empat digit terakhirnya. Cara itu punya lubang: dua
   orang yang menekan Simpan pada detik yang sama membaca nomor terakhir yang
   sama, menghasilkan nomor kembar, lalu salah satunya gagal simpan karena
   kolomnya unik — dan pekerjaannya hilang.

   Di sini lubang itu ditutup dengan dua lapis:

   1. Nomor berikutnya dihitung dari nilai TERBESAR yang pernah ada, bukan
      dari baris terakhir. Jadi baris yang dihapus tidak membuat nomor
      terpakai ulang.

   2. Kalau tabrakan tetap terjadi, penyimpanan diulang otomatis dengan nomor
      berikutnya. Pengguna tidak melihat kegagalan apa pun.
   ========================================================================== */

const BATAS_PERCOBAAN = 5;

/** Kode pelanggan: CUST-0001 */
export async function kodePelangganBerikutnya(): Promise<string> {
  return `CUST-${await urutanBerikutnya("customers", "customer_code")}`;
}

/** Kode produk: PRD-0001 */
export async function kodeProdukBerikutnya(): Promise<string> {
  return `PRD-${await urutanBerikutnya("products", "product_code")}`;
}

/**
 * Nomor dokumen bertahun: QUO-2026-0001, INV-2026-0014, PAY-2026-0003.
 *
 * Urutannya dihitung per tahun berjalan, jadi setiap Januari nomornya
 * kembali ke 0001 — sama seperti kebiasaan penomoran dokumen di Laravel-nya.
 */
export async function nomorDokumenBerikutnya(
  tabel: "quotations" | "invoices" | "payments",
  kolom: string,
  awalan: string,
): Promise<string> {
  const tahun = new Date().getFullYear();
  const pola = `${awalan}-${tahun}-`;

  const hasil = await prisma.$queryRawUnsafe<{ maks: number | null }[]>(
    `SELECT MAX(CAST(RIGHT("${kolom}", 4) AS INTEGER)) AS maks
       FROM "${tabel}"
      WHERE "${kolom}" LIKE $1
        AND RIGHT("${kolom}", 4) ~ '^[0-9]{4}$'`,
    `${pola}%`,
  );

  const berikutnya = (hasil[0]?.maks ?? 0) + 1;
  return `${pola}${String(berikutnya).padStart(4, "0")}`;
}

export function nomorPenawaranBerikutnya(): Promise<string> {
  return nomorDokumenBerikutnya("quotations", "quotation_number", "QUO");
}

async function urutanBerikutnya(tabel: string, kolom: string): Promise<string> {
  // Mengambil empat karakter terakhir kode, membuang yang bukan angka,
  // lalu mencari nilai terbesarnya.
  const hasil = await prisma.$queryRawUnsafe<{ maks: number | null }[]>(
    `SELECT MAX(CAST(RIGHT("${kolom}", 4) AS INTEGER)) AS maks
       FROM "${tabel}"
      WHERE RIGHT("${kolom}", 4) ~ '^[0-9]{4}$'`,
  );

  const berikutnya = (hasil[0]?.maks ?? 0) + 1;
  return String(berikutnya).padStart(4, "0");
}

/**
 * Menjalankan penyimpanan, dan mengulanginya kalau nomornya keburu dipakai
 * orang lain. `buatKode` dipanggil ulang setiap percobaan supaya nomornya
 * ikut maju.
 */
export async function simpanDenganKodeUnik<T>(
  buatKode: () => Promise<string>,
  simpan: (kode: string) => Promise<T>,
): Promise<T> {
  let galatTerakhir: unknown;

  for (let percobaan = 0; percobaan < BATAS_PERCOBAAN; percobaan++) {
    try {
      return await simpan(await buatKode());
    } catch (galat) {
      const tabrakan =
        galat instanceof Prisma.PrismaClientKnownRequestError && galat.code === "P2002";

      if (!tabrakan) throw galat;
      galatTerakhir = galat;
    }
  }

  throw galatTerakhir;
}
