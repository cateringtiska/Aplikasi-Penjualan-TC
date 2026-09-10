/**
 * Membuat akun admin pertama.
 *
 * Dijalankan sekali saja setelah database kosong dimigrasi:
 *   node scripts/buat-admin.mjs "Nama Lengkap" "email@perusahaan.com"
 *
 * Kata sandinya dibuat acak dan ditampilkan satu kali. Ganti setelah login
 * pertama lewat menu Pengguna.
 *
 * Sandi disimpan dalam bentuk bcrypt berawalan "$2y$" — sama persis dengan
 * yang dipakai Laravel, jadi akun ini juga bisa dipakai login di aplikasi lama.
 */

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const nama = process.argv[2];
const email = process.argv[3]?.trim().toLowerCase();

if (!nama || !email) {
  console.error('Cara pakai: node scripts/buat-admin.mjs "Nama Lengkap" "email@perusahaan.com"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const sudahAda = await prisma.users.findUnique({ where: { email } });

if (sudahAda) {
  console.error(`Email ${email} sudah terdaftar. Tidak ada yang diubah.`);
  await prisma.$disconnect();
  process.exit(1);
}

// 18 byte acak -> 24 karakter. Cukup panjang untuk tidak bisa ditebak,
// cukup pendek untuk diketik ulang sekali.
const sandi = randomBytes(18).toString("base64url");
const hash = await bcrypt.hash(sandi, 12);

const pengguna = await prisma.users.create({
  data: {
    name: nama,
    email,
    password: `$2y$${hash.slice(4)}`,
    role: "admin",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  select: { id: true, name: true, email: true, role: true },
});

console.log("\nAkun admin dibuat.\n");
console.log(`  Nama  : ${pengguna.name}`);
console.log(`  Email : ${pengguna.email}`);
console.log(`  Sandi : ${sandi}`);
console.log(`  Peran : ${pengguna.role}`);
console.log("\nSandi di atas hanya ditampilkan sekarang. Simpan, lalu ganti setelah login.\n");

await prisma.$disconnect();
