import { afterAll, describe, expect, it } from "vitest";

import { ambilPiutang } from "../lib/laporan-piutang";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   CUSTOMER YANG SUDAH LUNAS HARUS TETAP BISA DITEMUKAN

   Ini lahir dari kebingungan nyata: seorang pengguna mencatat pembayaran
   penuh untuk MEY Bakery, lalu mencari namanya di Kartu Piutang dan hanya
   mendapat "Tidak ditemukan piutang atas nama MEY Bakery". Ia menyimpulkan
   pembayarannya tidak tercatat — padahal justru sebaliknya.

   Menyembunyikan yang lunas dari daftar UMUR piutang itu benar: invoice yang
   sudah lunas tidak punya umur keterlambatan. Yang salah adalah membiarkan
   halaman kosong tanpa penjelasan.

   Jadi yang dikunci di sini: customer yang lunas TIDAK masuk daftar umur,
   TETAPI muncul di `lunas` beserta jalan menuju kartunya. Dan yang masih
   menyisakan seribu rupiah pun tetap dihitung sebagai piutang, bukan lunas.
   ========================================================================== */

const TANDA = "UJI LUNAS";
const jejak: bigint[] = [];

afterAll(async () => {
  for (const id of jejak) {
    const invoice = await prisma.invoices.findMany({
      where: { customer_id: id },
      select: { id: true },
    });
    const idInvoice = invoice.map((i) => i.id);
    await prisma.payment_details.deleteMany({ where: { invoice_id: { in: idInvoice } } });
    await prisma.payments.deleteMany({ where: { customer_id: id } });
    await prisma.invoices.deleteMany({ where: { customer_id: id } });
    await prisma.customers.delete({ where: { id } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

async function buatCustomer(nama: string, total: string, dibayar: string, status: string) {
  const cap = `${Date.now().toString().slice(-6)}${jejak.length}`;

  const pelanggan = await prisma.customers.create({
    data: {
      customer_code: `UJL-${cap}`,
      name: nama,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: { id: true },
  });
  jejak.push(pelanggan.id);

  await prisma.invoices.create({
    data: {
      invoice_number: `UJL-INV-${cap}`,
      customer_id: pelanggan.id,
      invoice_date: new Date(),
      due_date: new Date(),
      subtotal: total,
      grand_total: total,
      paid_amount: dibayar,
      status,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  return pelanggan.id.toString();
}

describe("ambilPiutang — customer yang sudah lunas", () => {
  it("mengeluarkannya dari daftar umur, tetapi menyebutkannya beserta jalan ke kartunya", async () => {
    const nama = `${TANDA} Lunas`;
    const id = await buatCustomer(nama, "1100000", "1100000", "paid");

    const { daftar, lunas } = await ambilPiutang(nama);

    // Tidak boleh mengotori daftar umur: ia tidak punya keterlambatan.
    expect(daftar).toHaveLength(0);

    // Tetapi harus tetap ditemukan, lengkap dengan jalan menuju riwayatnya.
    expect(lunas).toHaveLength(1);
    expect(lunas[0].nama).toBe(nama);
    expect(lunas[0].id).toBe(id);
    expect(lunas[0].jumlahInvoice).toBe(1);
    expect(lunas[0].totalDibayar.toFixed(0)).toBe("1100000");
  });

  it("tidak menyebut lunas customer yang masih menyisakan sedikit pun", async () => {
    const nama = `${TANDA} Kurang Seribu`;
    await buatCustomer(nama, "1100000", "1099000", "partial");

    const { daftar, lunas } = await ambilPiutang(nama);

    expect(daftar).toHaveLength(1);
    expect(daftar[0].total.toFixed(0)).toBe("1000");
    // Daftar piutangnya tidak kosong, jadi tidak perlu penjelasan apa pun.
    expect(lunas).toHaveLength(0);
  });

  it("tidak menyebut lunas customer yang belum pernah ditagih", async () => {
    const nama = `${TANDA} Belum Ditagih`;
    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJL-K${Date.now().toString().slice(-5)}`,
        name: nama,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true },
    });
    jejak.push(pelanggan.id);

    const { daftar, lunas } = await ambilPiutang(nama);

    expect(daftar).toHaveLength(0);
    // "Sudah lunas" untuk orang yang belum pernah ditagih adalah kalimat yang
    // menyesatkan: yang benar adalah ia belum punya transaksi sama sekali.
    expect(lunas).toHaveLength(0);
  });
});
