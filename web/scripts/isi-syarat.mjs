/**
 * Mengisi syarat & ketentuan default dari sebuah berkas teks.
 *
 *   node scripts/isi-syarat.mjs penawaran <berkas.txt>
 *   node scripts/isi-syarat.mjs tagihan   <berkas.txt>
 *
 * Dipakai ketika dokumennya terlalu panjang untuk ditempel lewat browser
 * dengan nyaman. Kolomnya bertipe text di PostgreSQL, jadi panjangnya tidak
 * dibatasi apa pun selain akal sehat.
 */

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const [jenis, berkas] = process.argv.slice(2);

const KOLOM = {
  penawaran: "quotation_terms_default",
  tagihan: "payment_terms_default",
};

if (!KOLOM[jenis] || !berkas) {
  console.error("Cara pakai: node scripts/isi-syarat.mjs <penawaran|tagihan> <berkas.txt>");
  process.exit(1);
}

const isi = readFileSync(berkas, "utf8").trim();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const sebelum = await prisma.company_settings.findUnique({ where: { id: BigInt(1) } });

await prisma.company_settings.upsert({
  where: { id: BigInt(1) },
  create: {
    id: BigInt(1),
    company_name: sebelum?.company_name ?? "TISKA Catering",
    [KOLOM[jenis]]: isi,
    created_at: new Date(),
    updated_at: new Date(),
  },
  update: { [KOLOM[jenis]]: isi, updated_at: new Date() },
});

const sesudah = await prisma.company_settings.findUniqueOrThrow({ where: { id: BigInt(1) } });
const tersimpan = sesudah[KOLOM[jenis]] ?? "";

console.log(`Kolom      : ${KOLOM[jenis]}`);
console.log(`Panjang    : ${isi.length.toLocaleString("id-ID")} karakter`);
console.log(`Tersimpan  : ${tersimpan.length.toLocaleString("id-ID")} karakter`);
console.log(`Utuh       : ${tersimpan === isi ? "YA" : "TIDAK — ada yang terpotong"}`);
console.log(`Baris      : ${isi.split("\n").length}`);
console.log(`\nAwal   : ${isi.slice(0, 60)}…`);
console.log(`Akhir  : …${isi.slice(-60)}`);

// Pengaturan lain dipastikan tidak ikut berubah.
console.log(`\nLogo tetap        : ${sesudah.logo_path ? "ada" : "belum ada"}`);
console.log(`Tanda tangan tetap: ${sesudah.signature_path ? "ada" : "belum ada"}`);
console.log(`Nama perusahaan   : ${sesudah.company_name}`);

await prisma.$disconnect();
process.exit(tersimpan === isi ? 0 : 1);
