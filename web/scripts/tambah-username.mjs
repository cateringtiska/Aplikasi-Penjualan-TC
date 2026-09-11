/**
 * Menambah login berbasis username ke tabel users.
 *
 *   node scripts/tambah-username.mjs            -> periksa saja
 *   node scripts/tambah-username.mjs --jalankan -> benar-benar mengubah
 *
 * Empat perubahan:
 *
 *   username        kolom baru, unik — dipakai untuk masuk
 *   email           dijadikan boleh kosong, karena tidak lagi wajib
 *   gagal_masuk     penghitung percobaan gagal berturut-turut
 *   terkunci_sampai waktu berakhirnya penguncian sementara
 *
 * Dua yang terakhir ada karena sandi kini boleh berupa PIN pendek. PIN enam
 * angka hanya sejuta kemungkinan — tanpa penguncian, menebaknya sampai tembus
 * cuma soal waktu. Dengan penguncian, penebak berhenti setelah lima percobaan.
 *
 * Username diisikan dari bagian depan email yang sudah ada. Kalau bentrok,
 * ditambahi angka di belakang.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const JALANKAN = process.argv.includes("--jalankan");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

/** "Reza Devyan <reza.devyan@gmail.com>" -> "reza.devyan" */
function usernameDari(email, nama) {
  const dasar = (email?.split("@")[0] || nama || "pengguna")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);

  return dasar.length >= 3 ? dasar : `pengguna${Date.now().toString().slice(-4)}`;
}

const pengguna = await prisma.users.findMany({
  select: { id: true, name: true, email: true },
  orderBy: { id: "asc" },
});

// Nama pengguna dihitung lebih dulu supaya bentrokan ketahuan sebelum menulis.
const dipakai = new Set();
const rencana = pengguna.map((p) => {
  let nama = usernameDari(p.email, p.name);
  let n = 2;
  while (dipakai.has(nama)) nama = `${usernameDari(p.email, p.name)}${n++}`;
  dipakai.add(nama);
  return { id: p.id, email: p.email, username: nama };
});

console.log(JALANKAN ? "MODE: MENGUBAH\n" : "MODE: PERIKSA SAJA — tambahkan --jalankan\n");
console.log("Username yang akan diisikan:");
for (const r of rencana) {
  console.log(`  id=${String(r.id).padEnd(3)} ${(r.email ?? "-").padEnd(30)} -> ${r.username}`);
}

if (!JALANKAN) {
  console.log("\nTidak ada yang diubah.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log("\nMenambah kolom…");
for (const sql of [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(50)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gagal_masuk" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terkunci_sampai" TIMESTAMP(0)`,
]) {
  await prisma.$executeRawUnsafe(sql);
  console.log(`  ${sql.slice(0, 72)}…`);
}

console.log("\nMengisi username…");
for (const r of rencana) {
  await prisma.$executeRawUnsafe(`UPDATE "users" SET "username" = $1 WHERE id = $2`, r.username, r.id);
  console.log(`  id=${r.id} -> ${r.username}`);
}

console.log("\nMengunci aturan kolom…");
for (const sql of [
  // Unik dan wajib diisi: username adalah identitas masuk sekarang.
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username")`,
  `ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`,
  // Email tidak lagi wajib. Di PostgreSQL, indeks unik tetap mengizinkan
  // banyak baris kosong, jadi beberapa pengguna boleh sama-sama tanpa email.
  `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
]) {
  await prisma.$executeRawUnsafe(sql);
  console.log(`  ${sql.slice(0, 72)}…`);
}

const hasil = await prisma.$queryRawUnsafe(`
  SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name IN ('username','email','gagal_masuk','terkunci_sampai')
  ORDER BY column_name`);

console.log("\nKeadaan akhir:");
for (const k of hasil) {
  console.log(`  ${k.column_name.padEnd(18)} ${k.data_type.padEnd(28)} boleh kosong: ${k.is_nullable}`);
}

await prisma.$disconnect();
console.log("\nSELESAI. Jalankan `npm run db:tarik` supaya Prisma mengenali kolom barunya.");
