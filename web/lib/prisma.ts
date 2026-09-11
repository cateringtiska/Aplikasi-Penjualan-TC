import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/* ==========================================================================
   KONEKSI DATABASE

   Dua pengaturan di bawah ini menentukan aplikasi hidup atau mati di Vercel.
   Keduanya dipasang setelah produksi sempat tumbang dengan pesan:

       (EMAXCONNSESSION) max clients reached in session mode
       max clients are limited to pool_size: 15

   1. PORT 6543, BUKAN 5432.
      Supabase menyediakan dua pooler. Port 5432 "session mode" memberi satu
      koneksi tetap per klien — cocok untuk migrasi, tetapi jatahnya hanya 15
      di paket gratis. Port 6543 "transaction mode" memulangkan koneksi ke
      kolam setiap selesai satu transaksi, sehingga sanggup melayani jauh
      lebih banyak pemanggil. Itulah yang dibutuhkan serverless, karena
      Vercel menjalankan banyak salinan fungsi sekaligus.

      Transaction mode aman di sini karena adapter Prisma mengirim kueri
      lewat extended protocol tanpa prepared statement bernama.

   2. max: 1.
      Tanpa ini, pustaka pg membuka sampai 10 koneksi PER SALINAN FUNGSI.
      Tiga salinan yang jalan bersamaan sudah melampaui jatah. Setiap salinan
      cukup memegang satu koneksi; kueri yang bersamaan mengantre sebentar,
      dan itu jauh lebih baik daripada seluruh halaman gagal.
   ========================================================================== */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL belum diisi. Salin dari .env.production, atau di Vercel isi lewat Project Settings -> Environment Variables.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function buatKlien(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    // Lepaskan koneksi yang menganggur supaya salinan fungsi yang sudah
    // selesai tidak menahan jatah milik salinan lain.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Bawaan Prisma hanya 5 detik untuk satu transaksi. Menyimpan satu
    // tagihan berisi belasan item berarti belasan perjalanan bolak-balik ke
    // Singapura, dan 5 detik terlalu mepet untuk itu. Transaksi yang mati di
    // tengah jalan menolak commit-nya, jadi seluruh pekerjaan hilang.
    transactionOptions: { timeout: 20_000, maxWait: 10_000 },
  });
}

// Di pengembangan, Next.js memuat ulang modul setiap kali berkas berubah.
// Tanpa penyimpanan di globalThis, setiap muat ulang membuka kolam koneksi
// baru dan dalam beberapa menit Supabase menolak dengan "too many clients".
export const prisma = globalForPrisma.prisma ?? buatKlien();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
