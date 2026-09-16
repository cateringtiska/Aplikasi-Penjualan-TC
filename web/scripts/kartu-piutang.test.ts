import { afterAll, describe, expect, it } from "vitest";

import { ambilKartuPiutang } from "../lib/kartu-piutang";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   SALDO BERJALAN KARTU PIUTANG

   Kartu ini dibuka justru ketika catatan kita dan catatan customer
   berselisih, lalu dicetak dan dikirim ke customer itu. Saldo yang meleset
   satu baris bukan sekadar bug di layar — ia menjadi surat yang salah.

   Tiga hal dikunci di sini:

   1. Urutan pada TANGGAL YANG SAMA. Invoice harus mendahului pembayaran.
      Kalau terbalik, saldo berjalannya sempat terbaca jauh lebih kecil pada
      hari itu — dan pada kasus lain bahkan minus, seolah kita berutang
      kepada customer.

   2. Invoice yang DIBATALKAN tidak ikut. Ia tidak pernah menjadi piutang;
      memasukkannya menggelembungkan tagihan yang kita akui.

   3. Satu baris per ALOKASI, bukan per setoran. Satu setoran yang menutup
      dua invoice harus terlihat sebagai dua baris — itulah yang dicari
      orang ketika menelusuri selisih.
   ========================================================================== */

const TANDA = "UJI KARTU";
const jejak = { pelanggan: null as bigint | null };

afterAll(async () => {
  if (jejak.pelanggan) {
    const invoice = await prisma.invoices.findMany({
      where: { customer_id: jejak.pelanggan },
      select: { id: true },
    });
    const idInvoice = invoice.map((i) => i.id);

    await prisma.payment_details.deleteMany({ where: { invoice_id: { in: idInvoice } } });
    await prisma.payments.deleteMany({ where: { customer_id: jejak.pelanggan } });
    await prisma.invoice_margins.deleteMany({ where: { invoice_id: { in: idInvoice } } });
    await prisma.invoice_costs.deleteMany({ where: { invoice_id: { in: idInvoice } } });
    await prisma.invoice_items.deleteMany({ where: { invoice_id: { in: idInvoice } } });
    await prisma.invoices.deleteMany({ where: { customer_id: jejak.pelanggan } });
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("ambilKartuPiutang", () => {
  it("menyusun mutasi berurutan waktu dengan saldo yang benar", async () => {
    const cap = Date.now().toString().slice(-6);

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJK-${cap}`,
        name: `${TANDA} Pelanggan`,
        address: "Jl. Uji Coba No. 3",
        phone: "0812000000",
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.pelanggan = pelanggan.id;

    async function buatInvoice(nomor: string, tanggal: string, total: string, status: string) {
      return prisma.invoices.create({
        data: {
          invoice_number: nomor,
          customer_id: pelanggan.id,
          invoice_date: tgl(tanggal),
          due_date: tgl(tanggal),
          subtotal: total,
          grand_total: total,
          status,
          paid_amount: "0",
          created_at: new Date(),
          updated_at: new Date(),
        },
        select: { id: true, invoice_number: true },
      });
    }

    const a = await buatInvoice(`UJK-INV-A-${cap}`, "2026-01-10", "5000000", "partial");
    const b = await buatInvoice(`UJK-INV-B-${cap}`, "2026-01-20", "3000000", "paid");
    // Dibatalkan: tidak boleh muncul di kartu sama sekali.
    await buatInvoice(`UJK-INV-C-${cap}`, "2026-01-25", "1000000", "cancelled");

    // Satu setoran, DUA alokasi, dan tanggalnya sama dengan invoice B.
    const bayar = await prisma.payments.create({
      data: {
        payment_number: `UJK-PAY-${cap}`,
        customer_id: pelanggan.id,
        payment_date: tgl("2026-01-20"),
        payment_method: "transfer",
        total_amount: "5000000",
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true, payment_number: true },
    });

    await prisma.payment_details.createMany({
      data: [
        { payment_id: bayar.id, invoice_id: a.id, amount_applied: "2000000", created_at: new Date(), updated_at: new Date() },
        { payment_id: bayar.id, invoice_id: b.id, amount_applied: "3000000", created_at: new Date(), updated_at: new Date() },
      ],
    });

    const kartu = await ambilKartuPiutang(pelanggan.id.toString());
    expect(kartu).not.toBeNull();
    const { baris, totalInvoice, totalBayar, sisa } = kartu!;

    // Empat baris: dua invoice yang diakui, dua alokasi pembayaran.
    // Yang dibatalkan tidak terhitung.
    expect(baris).toHaveLength(4);
    expect(baris.some((r) => r.nomor.includes("INV-C"))).toBe(false);

    const ringkas = baris.map((r) => [r.nomor, r.debit.toFixed(0), r.kredit.toFixed(0), r.saldo.toFixed(0)]);
    expect(ringkas).toEqual([
      [a.invoice_number, "5000000", "0", "5000000"],
      // Pada 20 Januari invoice didahulukan: piutangnya ada sebelum dibayar.
      [b.invoice_number, "3000000", "0", "8000000"],
      [bayar.payment_number, "0", "2000000", "6000000"],
      [bayar.payment_number, "0", "3000000", "3000000"],
    ]);

    // Setiap baris pembayaran menyebut invoice mana yang ditutupnya.
    expect(baris[2].keterangan).toBe(`untuk ${a.invoice_number}`);
    expect(baris[3].keterangan).toBe(`untuk ${b.invoice_number}`);

    expect(totalInvoice.toFixed(0)).toBe("8000000");
    expect(totalBayar.toFixed(0)).toBe("5000000");
    expect(sisa.toFixed(0)).toBe("3000000");
  });

  it("mengembalikan null untuk customer yang tidak ada", async () => {
    expect(await ambilKartuPiutang("999999999")).toBeNull();
  });
});
