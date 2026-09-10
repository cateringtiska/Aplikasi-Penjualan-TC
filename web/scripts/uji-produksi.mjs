/**
 * Memeriksa halaman produksi dengan sesi yang sah.
 *
 *   node scripts/uji-produksi.mjs
 *
 * Cookie sesi ditandatangani memakai AUTH_SECRET yang sama dengan server,
 * jadi ini melewati penjaga login secara benar — bukan menembusnya.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import "dotenv/config";

const BASIS = process.env.UJI_BASIS ?? "https://penjualan-tc.vercel.app";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
const admin = await prisma.users.findFirst({
  where: { role: "admin" },
  select: { id: true, name: true, email: true, role: true },
});
await prisma.$disconnect();

if (!admin) {
  console.error("Tidak ada akun admin.");
  process.exit(1);
}

const cookie = `sesi_tc=${await new SignJWT({
  id: admin.id.toString(),
  nama: admin.name,
  email: admin.email,
  peran: admin.role,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("8h")
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET))}`;

const halaman = [
  {
    jalur: "/dasbor",
    periksa: [
      ["kartu Piutang berjalan", /Piutang berjalan/],
      ["kartu Jatuh tempo", /Jatuh tempo/],
      ["panel Tagihan terbaru", /Tagihan terbaru/],
    ],
  },
  {
    jalur: "/pelanggan",
    periksa: [
      ["judul", /Pelanggan/],
      ["tombol tambah", /Tambah pelanggan/],
      ["kotak pencarian", /Cari nama, kode, PIC/],
      ["keadaan kosong", /Belum ada pelanggan/],
    ],
  },
  {
    jalur: "/produk",
    periksa: [
      ["judul", /Produk/],
      ["tombol tambah", /Tambah produk/],
      ["kotak pencarian", /Cari nama, kode, atau keterangan/],
      ["keadaan kosong", /Belum ada produk/],
    ],
  },
  {
    jalur: "/pelanggan?cari=zzzz",
    periksa: [["hasil kosong saat dicari", /Tidak ada yang cocok/]],
  },
];

let gagalTotal = 0;

for (const { jalur, periksa } of halaman) {
  const resp = await fetch(`${BASIS}${jalur}`, { headers: { cookie }, redirect: "manual" });
  const html = await resp.text();
  const rusak = /This page couldn.t load|A server error occurred/.test(html);

  console.log(`\n${jalur}  ->  ${resp.status}${rusak ? "  HALAMAN ERROR" : ""}`);
  if (rusak) gagalTotal++;

  for (const [label, pola] of periksa) {
    const ok = pola.test(html);
    if (!ok) gagalTotal++;
    console.log(`   ${ok ? "OK  " : "GAGAL"}  ${label}`);
  }
}

console.log(gagalTotal === 0 ? "\nSEMUA HALAMAN BEKERJA." : `\n${gagalTotal} pemeriksaan gagal.`);
process.exit(gagalTotal === 0 ? 0 : 1);
