/**
 * Membuat akun admin pertama.
 *
 * Dijalankan sekali saja setelah database kosong dimigrasi:
 *   node scripts/buat-admin.mjs "Nama Lengkap" namapengguna
 *
 * Masuk memakai nama pengguna, bukan email. Kata sandinya dibuat acak dan
 * ditampilkan satu kali — ganti setelah berhasil masuk lewat menu Pengguna.
 *
 * Sandi disimpan dalam bentuk bcrypt berawalan "$2y$" — sama persis dengan
 * yang dipakai Laravel, jadi akun ini juga bisa dipakai login di aplikasi lama.
 */

import { randomInt } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const nama = process.argv[2];
const username = process.argv[3]?.trim().toLowerCase();

if (!nama || !username) {
  console.error('Cara pakai: node scripts/buat-admin.mjs "Nama Lengkap" namapengguna');
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
  console.error(
    "Nama pengguna: 3-50 karakter, huruf kecil, angka, titik, garis bawah, atau strip.",
  );
  process.exit(1);
}

/**
 * Sandi acak yang masih nyaman diketik ulang.
 *
 * Huruf dan angka yang mudah tertukar sengaja dibuang — 0 dan O, 1 dan l dan
 * I — karena sandi ini akan dibacakan atau disalin dengan tangan.
 */
function sandiAcak() {
  const semua = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bagian = () =>
    Array.from({ length: 4 }, () => semua[randomInt(semua.length)]).join("");
  return `${bagian()}-${bagian()}-${bagian()}`;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const sudahAda = await prisma.users.findUnique({ where: { username } });

if (sudahAda) {
  console.error(`Nama pengguna "${username}" sudah terdaftar. Tidak ada yang diubah.`);
  await prisma.$disconnect();
  process.exit(1);
}

const sandi = sandiAcak();
const hash = await bcrypt.hash(sandi, 12);

const pengguna = await prisma.users.create({
  data: {
    name: nama,
    username,
    password: `$2y$${hash.slice(4)}`,
    role: "admin",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  select: { id: true, name: true, username: true, role: true },
});

console.log("\nAkun admin dibuat.\n");
console.log(`  Nama     : ${pengguna.name}`);
console.log(`  Pengguna : ${pengguna.username}`);
console.log(`  Peran    : ${pengguna.role}`);
console.log(`  Sandi    : ${sandi}`);
console.log("\nSandi di atas hanya ditampilkan sekarang. Simpan, lalu ganti setelah masuk.\n");

await prisma.$disconnect();
