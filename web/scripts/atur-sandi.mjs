/**
 * Mengatur ulang kata sandi seorang pengguna.
 *
 *   node scripts/atur-sandi.mjs budi
 *   node scripts/atur-sandi.mjs budi "sandi-pilihan-sendiri"
 *
 * Tanpa argumen kedua, sandinya dibuat acak dan ditampilkan satu kali.
 *
 * Dipakai ketika admin terkunci di luar aplikasinya sendiri — satu-satunya
 * jalan masuk yang tersisa, karena aplikasi ini sengaja tidak punya
 * pendaftaran mandiri maupun kirim-ulang sandi lewat email.
 *
 * Hash disimpan berawalan "$2y$", sama seperti yang dibuat Laravel, sehingga
 * akun yang sama tetap bisa dipakai masuk di aplikasi lama.
 */

import { randomInt } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const [username, sandiPilihan] = process.argv.slice(2);

if (!username) {
  console.error("Cara pakai: node scripts/atur-sandi.mjs <nama-pengguna> [sandi]");
  process.exit(1);
}

/**
 * Sandi acak yang masih nyaman diketik ulang.
 *
 * Huruf dan angka yang mudah tertukar sengaja dibuang — 0 dan O, 1 dan l dan
 * I — karena sandi ini akan dibacakan atau disalin dengan tangan.
 */
function sandiAcak() {
  const huruf = "abcdefghijkmnpqrstuvwxyz";
  const besar = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const angka = "23456789";
  const semua = huruf + besar + angka;

  const bagian = () =>
    Array.from({ length: 4 }, () => semua[randomInt(semua.length)]).join("");

  return `${bagian()}-${bagian()}-${bagian()}`;
}

const sandi = sandiPilihan?.trim() || sandiAcak();

if (sandi.length < 8) {
  console.error("Kata sandi minimal 8 karakter.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const pengguna = await prisma.users.findUnique({
  where: { username: username.trim().toLowerCase() },
  select: { id: true, name: true, username: true, role: true, is_active: true },
});

if (!pengguna) {
  console.error(`Tidak ada pengguna dengan nama ${username}.`);
  console.error("\nYang terdaftar:");
  for (const u of await prisma.users.findMany({ select: { username: true, role: true } })) {
    console.error(`  ${u.username} (${u.role})`);
  }
  await prisma.$disconnect();
  process.exit(1);
}

const hash = await bcrypt.hash(sandi, 12);

await prisma.users.update({
  where: { id: pengguna.id },
  data: {
    password: `$2y$${hash.slice(4)}`,
    // Sekalian diaktifkan: percuma mengganti sandi kalau akunnya masih
    // dinonaktifkan, karena penjaga akses menolaknya di setiap permintaan.
    is_active: true,
    // Kunci akibat salah sandi berulang ikut dibuka.
    gagal_masuk: 0,
    terkunci_sampai: null,
    updated_at: new Date(),
  },
});

// Dibuktikan dengan membaca ulang dan mencocokkan, bukan sekadar dianggap
// berhasil karena perintah update tidak melempar galat.
const sesudah = await prisma.users.findUniqueOrThrow({
  where: { id: pengguna.id },
  select: { password: true, is_active: true },
});
const cocok = await bcrypt.compare(sandi, `$2b$${sesudah.password.slice(4)}`);

console.log(`\nKata sandi ${pengguna.username} berhasil diatur ulang.\n`);
console.log(`  Nama     : ${pengguna.name}`);
console.log(`  Pengguna : ${pengguna.username}`);
console.log(`  Peran    : ${pengguna.role}`);
console.log(`  Aktif    : ${sesudah.is_active ? "ya" : "TIDAK"}`);
console.log(`  Sandi    : ${sandi}`);
console.log(`\n  Diverifikasi: ${cocok ? "sandi cocok saat dibaca ulang" : "GAGAL — sandi tidak cocok"}`);
console.log("\nGanti lewat menu Pengguna setelah berhasil masuk.\n");

await prisma.$disconnect();
process.exit(cocok ? 0 : 1);
