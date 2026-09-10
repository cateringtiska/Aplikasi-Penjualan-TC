import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Koneksi database.
//
// Mulai Prisma 7, klien menyambung lewat "driver adapter" — di sini adapter
// PostgreSQL resmi. URL-nya diambil dari DATABASE_URL.
//
// Di pengembangan, Next.js memuat ulang modul setiap kali berkas berubah.
// Tanpa penyimpanan di globalThis, setiap muat ulang membuka kumpulan koneksi
// baru dan dalam beberapa menit Supabase menolak dengan "too many clients".

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL belum diisi. Salin dari .env.production, atau di Vercel isi lewat Project Settings -> Environment Variables.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
