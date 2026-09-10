/**
 * Menguji koneksi database dengan pengaturan yang sama persis seperti
 * aplikasi di Vercel: transaction pooler, satu koneksi per proses.
 *
 *   node scripts/cek-koneksi.mjs
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diisi.");
  process.exit(1);
}

const port = new URL(url).port;
console.log(`Port     : ${port} (${port === "6543" ? "transaction pooler" : "session pooler"})`);

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  }),
});

const mulai = Date.now();

// Enam kueri sekaligus — persis seperti halaman dasbor. Ini yang tadi
// menghabiskan jatah koneksi di session mode.
const [pengguna, tagihan, penawaran, pelanggan, produk, piutang] = await Promise.all([
  prisma.users.count(),
  prisma.invoices.count(),
  prisma.quotations.count(),
  prisma.customers.count(),
  prisma.products.count(),
  prisma.invoices.aggregate({
    where: { status: { in: ["unpaid", "partial", "overdue"] } },
    _sum: { grand_total: true, paid_amount: true },
    _count: true,
  }),
]);

console.log(`Waktu    : ${Date.now() - mulai} ms untuk 6 kueri serentak`);
console.log("\nIsi database:");
console.log(`  pengguna  : ${pengguna}`);
console.log(`  tagihan   : ${tagihan}`);
console.log(`  penawaran : ${penawaran}`);
console.log(`  pelanggan : ${pelanggan}`);
console.log(`  produk    : ${produk}`);
console.log(`  agregat piutang terbaca: ${piutang._count} baris`);
console.log("\nBERHASIL — transaction pooler bekerja dengan max:1.");

await prisma.$disconnect();
