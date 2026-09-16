/**
 * Menyelaraskan daftar kategori biaya di DATABASE dengan yang ada di aplikasi.
 *
 *   node scripts/selaraskan-kategori-biaya.mjs
 *
 * Tabel invoice_costs punya CHECK constraint yang menyebut kategori satu per
 * satu. Menambah kategori di lib/biaya.ts saja TIDAK cukup: aplikasinya
 * menampilkan pilihan baru, pengguna memilihnya, lalu database menolak — dan
 * yang sampai ke layar hanya "Baris biaya gagal disimpan."
 *
 * Itu persis yang terjadi saat kategori "PB1 disetor" ditambahkan.
 *
 * Sekalian: quotation_costs dibuat belakangan TANPA batasan serupa, sehingga
 * kategori yang sama diterima di quotation tetapi ditolak di invoice.
 * Ketimpangan seperti itu yang membuat bug-nya membingungkan. Sekarang kedua
 * tabel memakai daftar yang sama.
 *
 * Aman dijalankan berulang kali.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

// Harus sama persis dengan NILAI_KATEGORI di lib/biaya.ts. Kalau keduanya
// menyimpang, scripts/kategori-biaya.test.ts akan gagal.
const KATEGORI = [
  "hpp_bahan_baku",
  "hpp_barang",
  "tenaga_kerja",
  "transportasi",
  "delivery",
  "vendor",
  "sewa_peralatan",
  "akomodasi",
  "entertainment",
  "pb1",
  "lain_lain",
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const daftar = KATEGORI.map((k) => `'${k}'`).join(", ");

for (const tabel of ["invoice_costs", "quotation_costs"]) {
  const nama = `${tabel}_category_check`;

  // Nilai yang sudah ada diperiksa lebih dulu: menambah batasan yang
  // dilanggar data lama akan menggagalkan seluruh perintah.
  const menyimpang = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT category FROM "${tabel}" WHERE category NOT IN (${daftar})`,
  );

  if (menyimpang.length > 0) {
    console.error(`\n${tabel}: ada nilai di luar daftar, batasan TIDAK dipasang:`);
    for (const m of menyimpang) console.error(`  ${m.category}`);
    continue;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${tabel}" DROP CONSTRAINT IF EXISTS "${nama}"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${tabel}" ADD CONSTRAINT "${nama}" CHECK (category IN (${daftar}))`,
  );

  console.log(`${tabel}: batasan dipasang ulang dengan ${KATEGORI.length} kategori.`);
}

/* ---------- Pembuktian ---------- */

const aturan = await prisma.$queryRawUnsafe(`
  SELECT t.relname AS tabel, pg_get_constraintdef(c.oid) AS aturan
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname IN ('invoice_costs','quotation_costs')
     AND c.contype = 'c' AND c.conname LIKE '%category%'
   ORDER BY t.relname
`);

console.log("\nDiperiksa ulang:");
for (const a of aturan) {
  const punyaPb1 = a.aturan.includes("'pb1'");
  console.log(`  ${a.tabel}: memuat 'pb1' -> ${punyaPb1 ? "ya" : "TIDAK"}`);
}
if (aturan.length !== 2) {
  console.error(`  HANYA ${aturan.length} batasan ditemukan, seharusnya 2.`);
}

await prisma.$disconnect();
