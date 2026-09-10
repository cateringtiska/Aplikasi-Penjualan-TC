/**
 * Menambah kolom nama penanda tangan ke company_settings.
 *
 * Di Laravel, nama penanda tangan ("Ida Raodah") ditulis langsung di dalam
 * berkas template PDF, jadi tidak bisa diubah tanpa mengubah kode. Kolom ini
 * memindahkannya ke pengaturan.
 *
 * Bersifat menambah dan boleh kosong, jadi aplikasi Laravel yang lama tetap
 * berjalan seperti biasa.
 *
 *   node scripts/tambah-kolom-penanda-tangan.mjs
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

await prisma.$executeRawUnsafe(
  `ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "signature_name" VARCHAR(255)`,
);

// Pastikan satu-satunya baris pengaturan sudah ada, supaya halaman
// pengaturan dan dokumen cetak tidak perlu menanganinya sebagai kasus khusus.
await prisma.$executeRawUnsafe(
  `INSERT INTO "company_settings" (id, company_name, created_at, updated_at)
   VALUES (1, 'Nama Perusahaan Anda', NOW(), NOW())
   ON CONFLICT (id) DO NOTHING`,
);

const kolom = await prisma.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'signature_name'`,
);

console.log(kolom.length > 0 ? "Kolom signature_name siap." : "GAGAL menambah kolom.");

const baris = await prisma.company_settings.count();
console.log(`Baris pengaturan: ${baris}`);

await prisma.$disconnect();
