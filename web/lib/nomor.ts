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

   ---------------------------------------------------------------------------
   SATU HAL YANG WAJIB DIPATUHI PEMANGGIL

   Kalau penomoran dipakai DI DALAM sebuah transaksi, `klien` HARUS diisi
   dengan klien transaksi itu (`tx`), bukan dibiarkan memakai klien global.

   Kolam koneksi aplikasi ini sengaja dibatasi satu koneksi per salinan fungsi
   (lihat prisma.ts). Transaksi yang sedang berjalan memegang koneksi itu,
   sehingga kueri lewat klien global harus MENGANTRE sampai transaksinya
   selesai. Antre itu memakan waktu lebih dari lima detik — melewati batas
   waktu transaksi Prisma — dan transaksinya mati sebelum sempat commit:

       A commit cannot be executed on an expired transaction.

   Akibatnya seluruh penawaran, tagihan, dan pembayaran baru gagal disimpan.
   Memakai `tx` membuat kueri nomor ikut menumpang koneksi yang sudah
   dipegang transaksi, jadi tidak ada yang perlu diantre.
   ========================================================================== */

const BATAS_PERCOBAAN = 5;

/**
 * Klien mana pun yang bisa menjalankan kueri mentah — klien global maupun
 * klien transaksi. Dibuat sesempit ini supaya keduanya sama-sama diterima.
 */
export type PenjalanKueri = Pick<Prisma.TransactionClient, "$queryRawUnsafe">;

/** Kode pelanggan: CUST-0001 */
export async function kodePelangganBerikutnya(klien: PenjalanKueri = prisma): Promise<string> {
  return `CUST-${await urutanBerikutnya("customers", "customer_code", klien)}`;
}

/** Kode produk: PRD-0001 */
export async function kodeProdukBerikutnya(klien: PenjalanKueri = prisma): Promise<string> {
  return `PRD-${await urutanBerikutnya("products", "product_code", klien)}`;
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
  klien: PenjalanKueri = prisma,
): Promise<string> {
  const tahun = new Date().getFullYear();
  const pola = `${awalan}-${tahun}-`;

  const hasil = await klien.$queryRawUnsafe<{ maks: number | null }[]>(
    `SELECT MAX(CAST(RIGHT("${kolom}", 4) AS INTEGER)) AS maks
       FROM "${tabel}"
      WHERE "${kolom}" LIKE $1
        AND RIGHT("${kolom}", 4) ~ '^[0-9]{4}$'`,
    `${pola}%`,
  );

  const berikutnya = (hasil[0]?.maks ?? 0) + 1;
  return `${pola}${String(berikutnya).padStart(4, "0")}`;
}

export function nomorPenawaranBerikutnya(klien: PenjalanKueri = prisma): Promise<string> {
  return nomorDokumenBerikutnya("quotations", "quotation_number", "QUO", klien);
}

async function urutanBerikutnya(
  tabel: string,
  kolom: string,
  klien: PenjalanKueri,
): Promise<string> {
  // Mengambil empat karakter terakhir kode, membuang yang bukan angka,
  // lalu mencari nilai terbesarnya.
  const hasil = await klien.$queryRawUnsafe<{ maks: number | null }[]>(
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
