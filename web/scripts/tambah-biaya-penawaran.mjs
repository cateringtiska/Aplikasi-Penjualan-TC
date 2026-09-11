/**
 * Menambah tabel biaya untuk PENAWARAN.
 *
 *   node scripts/tambah-biaya-penawaran.mjs
 *
 * Sampai sekarang biaya hanya bisa dicatat setelah acara jadi tagihan —
 * padahal keputusan yang paling menentukan untung-rugi diambil JAUH sebelum
 * itu, yaitu saat harga penawaran disusun. Tabel ini memungkinkan biaya
 * diperkirakan lebih dulu, sehingga marginnya sudah terlihat sebelum harga
 * dikirim ke klien.
 *
 * Bentuknya sengaja dibuat sama persis dengan invoice_costs, supaya barisnya
 * bisa disalin apa adanya ketika penawaran berubah menjadi tagihan.
 *
 * TIDAK ada tabel quotation_margins. Margin penawaran adalah perkiraan, dan
 * perkiraan tidak perlu difinalisasi — angkanya dihitung saat dibaca. Yang
 * dikunci hanyalah angka nyata di tagihan.
 *
 * Aman dijalankan berulang kali, dan tidak menyentuh satu pun tabel lama,
 * jadi aplikasi Laravel yang masih ada tetap berjalan seperti biasa.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "quotation_costs" (
    "id"               BIGSERIAL PRIMARY KEY,
    "quotation_id"     BIGINT NOT NULL,
    "category"         VARCHAR(255) NOT NULL,
    "description"      VARCHAR(255) NOT NULL,
    "estimated_amount" DECIMAL(15,2),
    "actual_amount"    DECIMAL(15,2),
    "status"           VARCHAR(255) NOT NULL DEFAULT 'estimasi',
    "notes"            TEXT,
    "created_by"       BIGINT,
    "created_at"       TIMESTAMP(0),
    "updated_at"       TIMESTAMP(0)
  )
`);

// Penawaran dihapus -> biayanya ikut hilang. Pengguna dihapus -> barisnya
// tetap ada, hanya kehilangan penandanya. Sama persis dengan aturan yang
// sudah dipakai invoice_costs.
await prisma.$executeRawUnsafe(`
  DO $$ BEGIN
    ALTER TABLE "quotation_costs"
      ADD CONSTRAINT "quotation_costs_quotation_id_foreign"
      FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`);

await prisma.$executeRawUnsafe(`
  DO $$ BEGIN
    ALTER TABLE "quotation_costs"
      ADD CONSTRAINT "quotation_costs_created_by_foreign"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`);

await prisma.$executeRawUnsafe(
  `CREATE INDEX IF NOT EXISTS "quotation_costs_quotation_id_index"
     ON "quotation_costs" ("quotation_id")`,
);

// Skema public sudah dicabut haknya dari anon/authenticated; tabel baru tidak
// boleh diam-diam mengembalikannya.
await prisma.$executeRawUnsafe(`REVOKE ALL ON TABLE "quotation_costs" FROM anon, authenticated`);

/* ---------- Pembuktian ---------- */

const kolom = await prisma.$queryRawUnsafe(
  `SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'quotation_costs' ORDER BY ordinal_position`,
);
console.log(`Kolom quotation_costs: ${kolom.length}`);
for (const k of kolom) console.log(`  ${k.column_name} (${k.data_type})`);

const kunci = await prisma.$queryRawUnsafe(`
  SELECT c.conname, pg_get_constraintdef(c.oid) AS aturan
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'quotation_costs' AND c.contype = 'f'
   ORDER BY c.conname
`);
console.log("\nKunci asing:");
for (const k of kunci) console.log(`  ${k.conname}: ${k.aturan}`);

const hak = await prisma.$queryRawUnsafe(`
  SELECT grantee, privilege_type FROM information_schema.role_table_grants
   WHERE table_name = 'quotation_costs' AND grantee IN ('anon', 'authenticated')
`);
console.log(`\nHak anon/authenticated yang tersisa: ${hak.length} (harus 0)`);

await prisma.$disconnect();
