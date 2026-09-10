/**
 * Memeriksa setiap halaman produksi benar-benar tampil, dengan sesi yang sah.
 *
 *   node scripts/uji-produksi.mjs
 *   UJI_BASIS=http://localhost:3000 node scripts/uji-produksi.mjs
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

// Satu dokumen contoh dari tiap jenis, supaya halaman ber-parameter ikut diuji.
const [penawaran, tagihan, pembayaran] = await Promise.all([
  prisma.quotations.findFirst({ select: { id: true }, orderBy: { id: "desc" } }),
  prisma.invoices.findFirst({ select: { id: true }, orderBy: { id: "desc" } }),
  prisma.payments.findFirst({ select: { id: true }, orderBy: { id: "desc" } }),
]);

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
  ["/dasbor", [/Piutang berjalan/, /Tagihan terbaru/]],
  ["/pelanggan", [/Tambah pelanggan/]],
  ["/produk", [/Tambah produk/]],
  ["/penawaran", [/Buat penawaran/, /Kadaluarsa/]],
  ["/penawaran/baru", [/Rincian penawaran/, /Service charge/, /Detail acara/]],
  ["/tagihan", [/Buat tagihan/, /Jatuh tempo/]],
  ["/tagihan/baru", [/Rincian tagihan/, /Jatuh tempo/]],
  ["/pembayaran", [/Catat pembayaran/]],
  ["/pembayaran/baru", [/Alokasi ke tagihan/, /Uang diterima/]],
  ["/laporan/penjualan", [/Laporan penjualan/, /Excel/, /Nilai tagihan/]],
  ["/laporan/piutang", [/Kartu piutang/, /Belum jatuh tempo/, /Lebih dari 60 hari/]],
  ["/laporan/margin", [/Laporan margin/, /Margin rata-rata/]],
  ["/pengguna", [/Tambah pengguna/, /Tidak ada pendaftaran mandiri/]],
  ["/perusahaan", [/Pengaturan perusahaan/, /Rekening pembayaran/, /Nama penanda tangan/]],
];

if (penawaran) {
  halaman.push([`/penawaran/${penawaran.id}`, [/Total penawaran/]]);
  halaman.push([`/penawaran/${penawaran.id}/cetak`, [/QUOTATION|Quotation/]]);
}
if (tagihan) {
  halaman.push([`/tagihan/${tagihan.id}`, [/Total tagihan/, /Riwayat pembayaran/]]);
  halaman.push([`/tagihan/${tagihan.id}/cetak`, [/INVOICE|Invoice/]]);
  halaman.push([`/tagihan/${tagihan.id}/margin`, [/Biaya &amp; margin|Biaya & margin/, /Penjualan bersih/]]);
}
if (pembayaran) {
  halaman.push([`/pembayaran/${pembayaran.id}`, [/Alokasi ke tagihan/]]);
}

let gagal = 0;

for (const [jalur, pola] of halaman) {
  let baris = `${jalur.padEnd(34)}`;

  try {
    const resp = await fetch(`${BASIS}${jalur}`, { headers: { cookie }, redirect: "manual" });
    const html = await resp.text();
    const rusak = /This page couldn.t load|A server error occurred/.test(html);
    const tidakCocok = pola.filter((p) => !p.test(html));

    if (resp.status !== 200 || rusak || tidakCocok.length > 0) {
      gagal++;
      baris += `GAGAL  status=${resp.status}`;
      if (rusak) baris += " HALAMAN ERROR";
      if (tidakCocok.length) baris += `  tidak ditemukan: ${tidakCocok.join(", ")}`;
    } else {
      baris += `OK     ${String(html.length).padStart(6)} karakter`;
    }
  } catch (galat) {
    gagal++;
    baris += `GAGAL  ${galat.message}`;
  }

  console.log(baris);
}

// Ekspor Excel diuji terpisah, karena yang diperiksa jenis berkasnya.
try {
  const resp = await fetch(`${BASIS}/laporan/penjualan/excel`, { headers: { cookie } });
  const jenis = resp.headers.get("content-type") ?? "";
  const ok = resp.status === 200 && jenis.includes("spreadsheetml");
  if (!ok) gagal++;
  console.log(`${"/laporan/penjualan/excel".padEnd(34)}${ok ? "OK     berkas xlsx" : `GAGAL  ${resp.status} ${jenis}`}`);
} catch (galat) {
  gagal++;
  console.log(`${"/laporan/penjualan/excel".padEnd(34)}GAGAL  ${galat.message}`);
}

console.log(
  gagal === 0
    ? `\nSEMUA ${halaman.length + 1} HALAMAN BEKERJA.`
    : `\n${gagal} pemeriksaan gagal.`,
);
process.exit(gagal === 0 ? 0 : 1);
