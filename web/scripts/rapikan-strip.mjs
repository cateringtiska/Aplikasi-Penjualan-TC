/**
 * Mengosongkan isian dokumen yang hanya berisi tanda hubung.
 *
 *   node scripts/rapikan-strip.mjs            (periksa saja)
 *   node scripts/rapikan-strip.mjs --jalankan
 *
 * Aturan "tanda hubung berarti kosong" berlaku saat dokumen DISIMPAN. Dokumen
 * yang terlanjur tersimpan sebelum aturan itu ada tetap menyimpan "-", dan
 * tanda itu ikut tercetak — paling terlihat di judul: "INVOICE - -".
 *
 * Hanya nilai yang SELURUHNYA tanda hubung yang dikosongkan. Alamat seperti
 * "The Telkom Hub - Jl. Gatot Subroto" tidak disentuh.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const JALANKAN = process.argv.includes("--jalankan");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const KOLOM = [
  "contact_person",
  "contact_phone",
  "event_type",
  "event_time",
  "fnb_planner",
  "venue",
  "notes",
];

const hanyaStrip = (n) => typeof n === "string" && /^\s*[-–—]+\s*$/.test(n);

console.log(JALANKAN ? "MENJALANKAN\n" : "PERIKSA SAJA (tambahkan --jalankan)\n");

let jumlah = 0;

for (const [tabel, kolomNomor] of [
  ["invoices", "invoice_number"],
  ["quotations", "quotation_number"],
]) {
  const baris = await prisma[tabel].findMany({
    select: Object.fromEntries([[kolomNomor, true], ["id", true], ...KOLOM.map((k) => [k, true])]),
  });

  for (const b of baris) {
    const perubahan = {};
    for (const k of KOLOM) if (hanyaStrip(b[k])) perubahan[k] = null;

    if (Object.keys(perubahan).length === 0) continue;

    jumlah++;
    console.log(`  ${b[kolomNomor]}: ${Object.keys(perubahan).join(", ")} -> kosong`);

    if (JALANKAN) {
      await prisma[tabel].update({ where: { id: b.id }, data: perubahan });
    }
  }
}

console.log(`\nDokumen yang perlu dirapikan: ${jumlah}`);

if (JALANKAN) {
  // Dibuktikan dengan membaca ulang, bukan dianggap berhasil karena tidak
  // ada galat.
  let sisa = 0;
  for (const tabel of ["invoices", "quotations"]) {
    const baris = await prisma[tabel].findMany({
      select: Object.fromEntries(KOLOM.map((k) => [k, true])),
    });
    for (const b of baris) for (const k of KOLOM) if (hanyaStrip(b[k])) sisa++;
  }
  console.log(`Diperiksa ulang: ${sisa} isian yang masih berisi tanda hubung (harus 0)`);
}

await prisma.$disconnect();
