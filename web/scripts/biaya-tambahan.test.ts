import { afterAll, describe, expect, it } from "vitest";

import { tulisBiayaTambahanTagihan } from "../lib/biaya-tambahan";
import { prisma } from "../lib/prisma";
import { d, hitungTotalDokumen } from "../lib/uang";

/* ==========================================================================
   BIAYA TAMBAHAN BERNAMA, DI LUAR PB1 DAN SERVICE CHARGE

   Dokumen katering sungguhan memuat baris seperti "Tim Servis utk Menu
   Buffet (1 orang)" dan "Tambahan Set-up & Layanan 1 Titik VIP Buffet".
   Namanya tidak mungkin ditebak sebelumnya, jadi tidak bisa dijadikan kolom
   tetap seperti delivery — ia disimpan sebagai barisnya sendiri.

   Rumusnya sudah dikunci tes satuan di lib/uang.test.ts. Yang dibuktikan DI
   SINI adalah hal-hal yang hanya kelihatan di database sungguhan:

   1. NILAINYA PULANG UTUH. Kolomnya NUMERIC(15,2); angka yang disimpan harus
      terbaca kembali persis, dan urutannya persis seperti yang diketik.

   2. DOKUMENNYA BISA MENJELASKAN TOTALNYA SENDIRI. grand_total yang tersimpan
      harus sama dengan hasil menjumlahkan ulang baris-barisnya sendiri. Kalau
      meleset, customer menerima dokumen yang rinciannya tidak menjelaskan
      angka yang ditagihkan — dan itu baru ketahuan saat ditanyakan balik.

   3. BARISNYA IKUT TERHAPUS bersama dokumennya. Tanpa cascade, menghapus satu
      invoice meninggalkan baris biaya tanpa induk, yang akan ikut terjumlah
      lagi begitu id-nya terpakai ulang.
   ========================================================================== */

const TANDA = "UJI BIAYA TAMBAHAN";

const jejak = {
  pelanggan: null as bigint | null,
  penawaran: null as bigint | null,
  tagihan: null as bigint | null,
};

afterAll(async () => {
  // invoice_charges dan quotation_charges sengaja TIDAK dihapus di sini —
  // cascade-nya yang harus membereskan, dan itu termasuk yang diuji.
  if (jejak.tagihan) {
    await prisma.invoices.delete({ where: { id: jejak.tagihan } }).catch(() => {});
  }
  if (jejak.penawaran) {
    await prisma.quotations.delete({ where: { id: jejak.penawaran } }).catch(() => {});
  }
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

/** Angka dari dokumen sungguhan yang ditunjukkan pemiliknya. */
const TAMBAHAN = [
  { label: "Tim Servis utk Menu Buffet (1 orang)", amount: "350000.00" },
  { label: "Layanan Servis Penyediaan Coffee/ Tea & Buffet", amount: "2700000.00" },
  { label: "Tambahan Set-up & Layanan 1 Titik VIP Buffet", amount: "1350000.00" },
];

describe("biaya tambahan tersimpan", () => {
  it("pulang utuh, berurutan, dan menjelaskan grand total dokumennya", async () => {
    const cap = Date.now().toString().slice(-6);

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJT-${cap}`,
        name: `${TANDA} Pelanggan`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.pelanggan = pelanggan.id;

    // Subtotal 13.500.000, PB1 10% = 1.350.000, tambahan 4.400.000.
    const total = hitungTotalDokumen({
      items: [
        { qty: 100, price: 35_000 },
        { qty: 100, price: 100_000 },
      ],
      pb1_enabled: true,
      pb1_percent: 10,
      biaya_tambahan: TAMBAHAN.map((b) => ({ label: b.label, amount: b.amount })),
    });
    expect(total.grand_total.toString()).toBe("19250000");

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UJT-INV-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: new Date(),
        due_date: new Date(),
        subtotal: total.subtotal.toFixed(2),
        pb1_enabled: true,
        pb1_percent: "10.00",
        pb1_amount: total.pb1_amount.toFixed(2),
        delivery_amount: "0.00",
        grand_total: total.grand_total.toFixed(2),
        status: "unpaid",
        paid_amount: "0",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.tagihan = tagihan.id;

    await prisma.invoice_charges.createMany({
      data: TAMBAHAN.map((b) => ({
        invoice_id: tagihan.id,
        label: b.label,
        amount: b.amount,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    });

    /* ---------- 1. Nilainya pulang utuh dan berurutan ---------- */

    const tersimpan = await prisma.invoices.findUniqueOrThrow({
      where: { id: tagihan.id },
      include: { invoice_charges: { orderBy: { id: "asc" } } },
    });

    expect(tersimpan.invoice_charges.map((b) => b.label)).toEqual(
      TAMBAHAN.map((b) => b.label),
    );
    expect(tersimpan.invoice_charges.map((b) => b.amount.toFixed(2))).toEqual(
      TAMBAHAN.map((b) => b.amount),
    );

    /* ---------- 2. Dokumennya menjelaskan totalnya sendiri ---------- */

    const dijumlahUlang = d(tersimpan.subtotal)
      .plus(d(tersimpan.service_charge_amount))
      .plus(d(tersimpan.pb1_amount))
      .plus(d(tersimpan.delivery_amount))
      .plus(
        tersimpan.invoice_charges.reduce((j, b) => j.plus(d(b.amount)), d(0)),
      );

    expect(dijumlahUlang.toFixed(2)).toBe(tersimpan.grand_total.toFixed(2));

    // Dan PB1-nya tetap dihitung dari subtotal saja — bukan dari subtotal
    // ditambah biaya tambahan, yang akan menghasilkan 1.790.000.
    expect(tersimpan.pb1_amount.toFixed(2)).toBe("1350000.00");
  });

  it("MENIMPA, bukan menambah, ketika dokumennya disimpan ulang", async () => {
    // Inti bahayanya. Menyimpan ulang satu invoice menghitung grand_total dari
    // formulir, sekali. Kalau barisnya hanya ditambahkan, rinciannya jadi dua
    // kali lipat sementara totalnya tidak — dokumen yang dikirim ke customer
    // lalu memuat kolom yang jumlahnya melebihi angka yang ditagihkan.
    const siap = TAMBAHAN.map((b) => ({ label: b.label, amount: d(b.amount) }));

    const pertama = await prisma.$transaction((tx) =>
      tulisBiayaTambahanTagihan(jejak.tagihan!, siap, tx),
    );
    expect(pertama).toBe(3);

    // Disimpan ulang dengan isi yang sama, lalu dengan isi yang lebih sedikit.
    await prisma.$transaction((tx) => tulisBiayaTambahanTagihan(jejak.tagihan!, siap, tx));
    expect(await prisma.invoice_charges.count({ where: { invoice_id: jejak.tagihan! } })).toBe(3);

    await prisma.$transaction((tx) =>
      tulisBiayaTambahanTagihan(jejak.tagihan!, siap.slice(0, 1), tx),
    );
    const sisa = await prisma.invoice_charges.findMany({
      where: { invoice_id: jejak.tagihan! },
      orderBy: { id: "asc" },
    });
    expect(sisa.map((b) => b.label)).toEqual([TAMBAHAN[0].label]);

    // Baris yang dihapus dari formulir harus benar-benar hilang.
    await prisma.$transaction((tx) => tulisBiayaTambahanTagihan(jejak.tagihan!, [], tx));
    expect(await prisma.invoice_charges.count({ where: { invoice_id: jejak.tagihan! } })).toBe(0);
  });

  it("ikut terhapus bersama dokumen induknya", async () => {
    const cap = `${Date.now().toString().slice(-6)}h`;

    const penawaran = await prisma.quotations.create({
      data: {
        quotation_number: `UJT-QUO-${cap}`,
        customer_id: jejak.pelanggan!,
        quotation_date: new Date(),
        valid_until: new Date(),
        subtotal: "1000000.00",
        grand_total: "1500000.00",
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
        quotation_charges: {
          create: [
            {
              label: "Set-up panggung",
              amount: "500000.00",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        },
      },
      include: { quotation_charges: true },
    });

    const idBaris = penawaran.quotation_charges[0].id;
    expect(await prisma.quotation_charges.count({ where: { id: idBaris } })).toBe(1);

    await prisma.quotations.delete({ where: { id: penawaran.id } });

    // Tanpa cascade, baris ini tertinggal tanpa induk.
    expect(await prisma.quotation_charges.count({ where: { id: idBaris } })).toBe(0);
  });
});
