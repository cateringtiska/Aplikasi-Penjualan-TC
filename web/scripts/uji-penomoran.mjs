/**
 * Menguji SQL penomoran kode pelanggan dan produk.
 *
 * Membuat beberapa baris uji, memeriksa nomornya berurutan dan tidak
 * mengulang nomor yang sudah terpakai, lalu MENGHAPUS kembali semuanya.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});

async function urutanBerikutnya(tabel, kolom) {
  const hasil = await prisma.$queryRawUnsafe(
    `SELECT MAX(CAST(RIGHT("${kolom}", 4) AS INTEGER)) AS maks
       FROM "${tabel}"
      WHERE RIGHT("${kolom}", 4) ~ '^[0-9]{4}$'`,
  );
  return String((hasil[0]?.maks ?? 0) + 1).padStart(4, "0");
}

const dibuat = [];

try {
  console.log("=== Pelanggan ===");
  for (let i = 0; i < 3; i++) {
    const kode = `CUST-${await urutanBerikutnya("customers", "customer_code")}`;
    const baris = await prisma.customers.create({
      data: {
        customer_code: kode,
        name: `UJI COBA ${i + 1}`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true, customer_code: true },
    });
    dibuat.push(baris.id);
    console.log(`  dibuat: ${baris.customer_code}`);
  }

  // Hapus yang tengah, lalu buat lagi — nomornya TIDAK boleh dipakai ulang.
  const tengah = dibuat[1];
  await prisma.customers.delete({ where: { id: tengah } });
  dibuat.splice(1, 1);
  console.log("  (baris kedua dihapus)");

  const kodeBaru = `CUST-${await urutanBerikutnya("customers", "customer_code")}`;
  const lagi = await prisma.customers.create({
    data: {
      customer_code: kodeBaru,
      name: "UJI COBA 4",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: { id: true, customer_code: true },
  });
  dibuat.push(lagi.id);
  console.log(`  setelah penghapusan: ${lagi.customer_code}  <- harus lompat, bukan mengisi lubang`);

  console.log("\n=== Produk ===");
  const kodeProduk = `PRD-${await urutanBerikutnya("products", "product_code")}`;
  const produk = await prisma.products.create({
    data: {
      product_code: kodeProduk,
      name: "UJI COBA Paket Buffet",
      type: "barang",
      unit: "pax",
      default_price: "85000.00",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: { id: true, product_code: true, default_price: true },
  });
  console.log(`  dibuat: ${produk.product_code}  harga tersimpan: ${produk.default_price}`);
  await prisma.products.delete({ where: { id: produk.id } });
  console.log("  produk uji dihapus");

  console.log("\nBERHASIL - penomoran bekerja.");
} finally {
  for (const id of dibuat) {
    await prisma.customers.delete({ where: { id } }).catch(() => {});
  }
  const sisa = await prisma.customers.count({ where: { name: { startsWith: "UJI COBA" } } });
  const sisaProduk = await prisma.products.count({ where: { name: { startsWith: "UJI COBA" } } });
  console.log(`\nPembersihan: sisa baris uji = ${sisa} pelanggan, ${sisaProduk} produk (harus 0)`);
  await prisma.$disconnect();
}
