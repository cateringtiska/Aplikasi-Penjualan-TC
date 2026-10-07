import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma";
import { d, hitungStatusInvoice, revisiInvoiceSah } from "../lib/uang";

/* ==========================================================================
   INVOICE YANG SUDAH DIBAYAR BOLEH NAIK, TIDAK BOLEH TURUN

   Tambahan menu saat acara berlangsung adalah kejadian biasa di katering,
   dan invoice-nya sudah telanjur dikirim beserta DP yang sudah dibayar.
   Karena itu invoice yang sudah menerima payment kini boleh diubah.

   Yang menahannya hanya satu: nilainya tidak boleh jatuh DI BAWAH uang yang
   sudah masuk. Kalau terlepas, yang dibayar menjadi lebih besar daripada
   yang ditagihkan — kelebihannya tidak punya tempat, invoice-nya terbaca
   "Lunas" padahal ada uang menggantung, dan TIDAK ADA SATU PUN LAYAR yang
   memperlihatkan bahwa itu terjadi. Sisa yang minus hanya terlihat kalau
   ada yang kebetulan membandingkan dua angka di halaman yang berbeda.

   Alokasi pembayarannya sendiri tidak boleh ikut bergerak saat revisi: DP
   yang sudah dicatat tetap menempel di tempatnya, dan hanya nilai
   invoice-nya yang berubah.
   ========================================================================== */

const TANDA = "UJI REVISI INVOICE";

const jejak = {
  pelanggan: null as bigint | null,
  tagihan: null as bigint | null,
  pembayaran: null as bigint | null,
};

afterAll(async () => {
  if (jejak.pembayaran) {
    await prisma.payment_details.deleteMany({ where: { payment_id: jejak.pembayaran } });
    await prisma.payments.delete({ where: { id: jejak.pembayaran } }).catch(() => {});
  }
  if (jejak.tagihan) {
    await prisma.invoices.delete({ where: { id: jejak.tagihan } }).catch(() => {});
  }
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

describe("sisa dan status sesudah revisi naik", () => {
  it("DP tetap, sisanya bertambah, dan Lunas kembali menjadi Sebagian", async () => {
    const cap = Date.now().toString().slice(-6);

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UREV-${cap}`,
        name: `${TANDA} Pelanggan`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.pelanggan = pelanggan.id;

    // Dibuat sudah LUNAS: 3.000.000 ditagihkan, 3.000.000 dibayar.
    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UREV-INV-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86_400_000),
        subtotal: "3000000",
        grand_total: "3000000",
        paid_amount: "3000000",
        status: "paid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.tagihan = tagihan.id;

    // Tambahan menu saat acara: nilainya naik menjadi 5.000.000.
    await prisma.invoices.update({
      where: { id: tagihan.id },
      data: {
        subtotal: "5000000",
        grand_total: "5000000",
        revision: { increment: 1 },
        revised_at: new Date(),
      },
    });

    const sesudah = await prisma.invoices.findUniqueOrThrow({
      where: { id: tagihan.id },
      select: {
        grand_total: true,
        paid_amount: true,
        status: true,
        due_date: true,
        revision: true,
        revised_at: true,
      },
    });

    // DP tidak berpindah ke mana pun.
    expect(sesudah.paid_amount.toString()).toBe("3000000");

    const sisa = d(sesudah.grand_total).minus(d(sesudah.paid_amount));
    expect(sisa.toString()).toBe("2000000");

    const status = hitungStatusInvoice({
      statusSekarang: sesudah.status,
      grandTotal: sesudah.grand_total.toString(),
      totalDibayar: sesudah.paid_amount.toString(),
      dueDate: sesudah.due_date,
    });
    expect(status, "invoice yang nilainya naik masih terbaca Lunas").toBe("partial");

    expect(sesudah.revision).toBe(1);
    expect(sesudah.revised_at).not.toBeNull();
  });
});

describe("aturan batas bawahnya", () => {
  /*
   * Yang dipanggil di sini adalah fungsi yang SAMA PERSIS dengan yang
   * dipakai simpanTagihan(), bukan tiruan aturannya. Tes yang menuliskan
   * ulang aturannya hanya membuktikan bahwa salinannya cocok dengan dirinya
   * sendiri, dan tetap hijau walaupun kode sungguhannya berubah.
   */
  const bolehDisimpan = revisiInvoiceSah;

  it("MENOLAK nilai yang jatuh di bawah uang yang sudah masuk", () => {
    expect(bolehDisimpan("2999999", "3000000")).toBe(false);
    expect(bolehDisimpan("0", "3000000")).toBe(false);
  });

  it("MENERIMA nilai yang naik, dan yang pas sama", () => {
    expect(bolehDisimpan("5000000", "3000000")).toBe(true);
    expect(bolehDisimpan("3000000", "3000000")).toBe(true);
  });

  it("tidak menghalangi invoice yang belum dibayar sama sekali", () => {
    // Membetulkan invoice yang belum dibayar bukan revisi, dan tidak ada
    // batas bawah apa pun di sana.
    expect(bolehDisimpan("100", "0")).toBe(true);
    expect(bolehDisimpan("0", "0")).toBe(true);
  });
});
