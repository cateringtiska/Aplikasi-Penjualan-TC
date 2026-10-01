/**
 * Mengosongkan seluruh data TRANSAKSI, dan hanya itu.
 *
 *   node scripts/kosongkan-transaksi.mjs            (periksa saja)
 *   node scripts/kosongkan-transaksi.mjs --jalankan
 *
 * Dipakai sekali saat beralih dari data percobaan ke data sungguhan.
 *
 * YANG DIHAPUS : quotation, invoice, pembayaran, beserta seluruh item,
 *                biaya, dan ringkasan marginnya.
 * YANG DISIMPAN: customer, produk, user, dan pengaturan perusahaan.
 *
 * Nomor dokumen dihitung dari nilai TERBESAR yang pernah ada, bukan dari
 * baris terakhir — jadi setelah pengosongan ini, dokumen berikutnya kembali
 * ke QUO-2026-0001. Itu memang yang diinginkan saat memulai dari awal.
 *
 * JALANKAN scripts/cadangkan.mjs LEBIH DULU. Supabase paket gratis tidak
 * menyediakan pencadangan otomatis, dan penghapusan ini tidak bisa dibatalkan.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const JALANKAN = process.argv.includes("--jalankan");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

// Urutannya mengikuti arah kunci asing: yang menumpang dihapus lebih dulu.
// Beberapa di antaranya sebenarnya ikut terhapus sendiri lewat ON DELETE
// CASCADE, tetapi disebut satu per satu supaya jumlahnya bisa dilaporkan dan
// tidak ada yang mengandalkan perilaku yang tidak terlihat.
const URUTAN = [
  "payment_details",
  "payments",
  "invoice_margins",
  "invoice_costs",
  "invoice_items",
  "invoices",
  "quotation_costs",
  "quotation_items",
  "quotations",
];

const DISIMPAN = ["customers", "products", "users", "company_settings"];

console.log(JALANKAN ? "MENJALANKAN — tidak bisa dibatalkan\n" : "PERIKSA SAJA (tambahkan --jalankan)\n");

const sebelum = {};
for (const t of [...URUTAN, ...DISIMPAN]) sebelum[t] = await prisma[t].count();

console.log("Akan dihapus:");
for (const t of URUTAN) console.log(`  ${t.padEnd(18)} ${sebelum[t]}`);
console.log("\nTidak disentuh:");
for (const t of DISIMPAN) console.log(`  ${t.padEnd(18)} ${sebelum[t]}`);

if (!JALANKAN) {
  await prisma.$disconnect();
  process.exit(0);
}

console.log("\nMenghapus…");
for (const t of URUTAN) {
  const { count } = await prisma[t].deleteMany({});
  console.log(`  ${t.padEnd(18)} ${count} terhapus`);
}

/* ---------- Pembuktian ---------- */

console.log("\nDiperiksa ulang:");

let gagal = 0;

for (const t of URUTAN) {
  const sisa = await prisma[t].count();
  if (sisa !== 0) {
    console.log(`  ${t}: MASIH ADA ${sisa} baris`);
    gagal++;
  }
}
if (gagal === 0) console.log("  seluruh tabel transaksi kosong");

for (const t of DISIMPAN) {
  const sesudah = await prisma[t].count();
  const utuh = sesudah === sebelum[t];
  console.log(`  ${t.padEnd(18)} ${sebelum[t]} -> ${sesudah}  ${utuh ? "utuh" : "BERUBAH"}`);
  if (!utuh) gagal++;
}

await prisma.$disconnect();
process.exit(gagal === 0 ? 0 : 1);
