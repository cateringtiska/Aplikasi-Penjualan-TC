/**
 * Menghitung ulang seluruh ringkasan margin yang sudah tersimpan.
 *
 *   node scripts/hitung-ulang-margin.mjs            (periksa saja)
 *   node scripts/hitung-ulang-margin.mjs --jalankan
 *
 * Wajib dijalankan sekali setelah aturan margin berubah dari "hanya subtotal"
 * menjadi "seluruh nilai tagihan".
 *
 * Tabel invoice_margins adalah RINGKASAN, bukan sumber kebenaran: angkanya
 * dihitung saat biaya berubah, lalu disimpan. Mengubah rumusnya tidak
 * menyentuh baris yang terlanjur tersimpan — laporan margin akan menampilkan
 * angka lama untuk invoice lama dan angka baru untuk invoice berikutnya,
 * bercampur dalam satu tabel tanpa penanda apa pun.
 *
 * Tidak menyentuh status final: yang diperbarui hanya angkanya.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const JALANKAN = process.argv.includes("--jalankan");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const rp = (n) => "Rp " + Number(n ?? 0).toLocaleString("id-ID");

/** Aturan yang sama dengan lib/uang.ts: aktual menimpa estimasi bila di atas nol. */
function nilaiBiaya(b) {
  const aktual = Number(b.actual_amount ?? 0);
  return aktual > 0 ? aktual : Number(b.estimated_amount ?? 0);
}

const margin = await prisma.invoice_margins.findMany({
  select: {
    invoice_id: true,
    net_sales: true,
    total_cost: true,
    profit: true,
    status: true,
    invoices: { select: { invoice_number: true, grand_total: true } },
  },
  orderBy: { invoice_id: "asc" },
});

console.log(JALANKAN ? "MENJALANKAN" : "PERIKSA SAJA (tambahkan --jalankan)");
console.log(`\nRingkasan margin tersimpan: ${margin.length}\n`);

let berubah = 0;

for (const m of margin) {
  const biaya = await prisma.invoice_costs.findMany({
    where: { invoice_id: m.invoice_id },
    select: { estimated_amount: true, actual_amount: true },
  });

  const net_sales = Number(m.invoices.grand_total);
  const total_cost = biaya.reduce((j, b) => j + nilaiBiaya(b), 0);
  const profit = net_sales - total_cost;
  const margin_percent = net_sales > 0 ? Math.round((profit / net_sales) * 10000) / 100 : 0;

  const lama = Number(m.net_sales);
  const sama = Math.abs(lama - net_sales) < 0.005;

  console.log(
    `  ${m.invoices.invoice_number}  penjualan ${rp(lama)} -> ${rp(net_sales)}` +
      `  untung ${rp(m.profit)} -> ${rp(profit)}` +
      `  ${sama ? "(tidak berubah)" : "BERUBAH"}${m.status === "final" ? " [final]" : ""}`,
  );

  if (!sama) berubah++;

  if (JALANKAN) {
    await prisma.invoice_margins.update({
      where: { invoice_id: m.invoice_id },
      data: {
        net_sales: net_sales.toFixed(2),
        total_cost: total_cost.toFixed(2),
        profit: profit.toFixed(2),
        margin_percent: margin_percent.toFixed(2),
        profit_status: profit >= 0 ? "untung" : "rugi",
        updated_at: new Date(),
        // status sengaja TIDAK disentuh: finalisasi adalah keputusan orang,
        // bukan akibat sampingan dari perubahan rumus.
      },
    });
  }
}

console.log(`\nYang angkanya berubah: ${berubah} dari ${margin.length}`);

if (JALANKAN) {
  // Dibuktikan dengan membaca ulang, bukan dianggap berhasil karena tidak ada galat.
  const sesudah = await prisma.invoice_margins.findMany({
    select: { net_sales: true, invoices: { select: { grand_total: true, invoice_number: true } } },
  });
  const meleset = sesudah.filter(
    (m) => Math.abs(Number(m.net_sales) - Number(m.invoices.grand_total)) >= 0.005,
  );
  console.log(`\nDiperiksa ulang: ${meleset.length} baris yang masih meleset (harus 0)`);
  for (const m of meleset) console.log(`  MELESET: ${m.invoices.invoice_number}`);
}

await prisma.$disconnect();
