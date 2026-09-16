import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma";
import {
  d,
  hitungMargin,
  hitungStatusInvoice,
  hitungTotalDokumen,
  nilaiBiaya,
  type StatusInvoice,
} from "../lib/uang";

/* ==========================================================================
   UJI ALUR UANG UJUNG KE UJUNG

       npm run uji:alur

   Menjalankan satu acara katering lengkap di database sungguhan:
   penawaran -> tagihan -> dua kali pembayaran -> biaya -> margin,
   lalu MENGHAPUS kembali seluruh jejaknya.

   Bedanya dengan tes di lib/uang.test.ts: yang di sana menguji rumusnya di
   atas kertas, yang di sini menguji bahwa angka yang benar-benar TERSIMPAN
   dan TERBACA KEMBALI dari PostgreSQL juga sama. Pembulatan decimal(15,2),
   penjumlahan di sisi database, dan urutan penetapan status hanya bisa
   ketahuan lewat cara ini.
   ========================================================================== */

const TANDA = "UJI ALUR";

// Penawaran pernikahan yang sama dengan yang dipakai di tes rumus, supaya
// angka yang diharapkan bisa dibandingkan langsung antar kedua berkas.
const ITEM = [
  { nama: "Paket Buffet Prasmanan", qty: 300, harga: 85_000, sc: true, compliment: false },
  { nama: "Pondokan Sate Ayam", qty: 2, harga: 2_500_000, sc: true, compliment: false },
  { nama: "Sewa Tenda & Kursi", qty: 1, harga: 7_500_000, sc: false, compliment: false },
  { nama: "Welcome Drink", qty: 300, harga: 15_000, sc: true, compliment: true },
];

const jejak = {
  pelanggan: null as bigint | null,
  penawaran: null as bigint | null,
  tagihan: null as bigint | null,
  pembayaran: [] as bigint[],
};

afterAll(async () => {
  // Urutannya penting: yang menumpang dihapus lebih dulu.
  for (const id of jejak.pembayaran) {
    await prisma.payment_details.deleteMany({ where: { payment_id: id } });
    await prisma.payments.delete({ where: { id } }).catch(() => {});
  }
  if (jejak.tagihan) {
    await prisma.invoice_margins.deleteMany({ where: { invoice_id: jejak.tagihan } });
    await prisma.invoice_costs.deleteMany({ where: { invoice_id: jejak.tagihan } });
    await prisma.invoice_items.deleteMany({ where: { invoice_id: jejak.tagihan } });
    await prisma.invoices.delete({ where: { id: jejak.tagihan } }).catch(() => {});
  }
  if (jejak.penawaran) {
    await prisma.quotation_items.deleteMany({ where: { quotation_id: jejak.penawaran } });
    await prisma.quotations.delete({ where: { id: jejak.penawaran } }).catch(() => {});
  }
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

const total = hitungTotalDokumen({
  items: ITEM.map((i) => ({
    qty: i.qty,
    price: i.harga,
    charge_service: i.sc,
    is_compliment: i.compliment,
  })),
  service_charge_percent: 5,
  pb1_enabled: true,
  pb1_percent: 10,
});

describe("Alur penuh satu acara katering", () => {
  it("menyimpan penawaran dengan total yang benar", async () => {
    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJI-${Date.now().toString().slice(-6)}`,
        name: `${TANDA} Pelanggan`,
        address: "Jl. Uji Coba No. 1",
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.pelanggan = pelanggan.id;

    const penawaran = await prisma.quotations.create({
      data: {
        quotation_number: `UJI-QUO-${Date.now()}`,
        customer_id: pelanggan.id,
        quotation_date: new Date("2026-09-10"),
        valid_until: new Date("2026-09-24"),
        status: "draft",
        event_type: "Resepsi pernikahan",
        guest_count: 300,
        subtotal: total.subtotal.toFixed(2),
        service_charge_percent: "5.00",
        service_charge_amount: total.service_charge_amount.toFixed(2),
        pb1_enabled: true,
        pb1_percent: "10.00",
        pb1_amount: total.pb1_amount.toFixed(2),
        grand_total: total.grand_total.toFixed(2),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.penawaran = penawaran.id;

    for (const i of ITEM) {
      await prisma.quotation_items.create({
        data: {
          quotation_id: penawaran.id,
          item_name: i.nama,
          unit: "pax",
          qty: String(i.qty),
          price: String(i.harga),
          subtotal: i.compliment ? "0" : String(i.qty * i.harga),
          is_compliment: i.compliment,
          charge_service: i.sc,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    // Dibaca ULANG dari database — inilah inti tesnya.
    const tersimpan = await prisma.quotations.findUniqueOrThrow({
      where: { id: penawaran.id },
    });

    expect(tersimpan.subtotal.toString()).toBe("38000000");
    expect(tersimpan.service_charge_amount.toString()).toBe("1525000");
    expect(tersimpan.pb1_amount.toString()).toBe("3800000");
    expect(tersimpan.grand_total.toString()).toBe("43325000");
  });

  it("menurunkan tagihan dengan angka yang sama persis", async () => {
    const asal = await prisma.quotations.findUniqueOrThrow({
      where: { id: jejak.penawaran! },
      include: { quotation_items: true },
    });

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UJI-INV-${Date.now()}`,
        quotation_id: asal.id,
        customer_id: asal.customer_id,
        invoice_date: new Date("2026-09-10"),
        due_date: new Date("2026-09-24"),
        status: "unpaid",
        paid_amount: "0",
        subtotal: asal.subtotal,
        service_charge_percent: asal.service_charge_percent,
        service_charge_amount: asal.service_charge_amount,
        pb1_enabled: asal.pb1_enabled,
        pb1_percent: asal.pb1_percent,
        pb1_amount: asal.pb1_amount,
        grand_total: asal.grand_total,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.tagihan = tagihan.id;

    for (const b of asal.quotation_items) {
      await prisma.invoice_items.create({
        data: {
          invoice_id: tagihan.id,
          item_name: b.item_name,
          unit: b.unit,
          qty: b.qty,
          price: b.price,
          subtotal: b.subtotal,
          is_compliment: b.is_compliment,
          charge_service: b.charge_service,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    // Angka tagihan tidak boleh menyimpang satu rupiah pun dari penawarannya.
    expect(tagihan.grand_total.toString()).toBe(asal.grand_total.toString());
    expect(tagihan.subtotal.toString()).toBe(asal.subtotal.toString());
  });

  it("menjadi dibayar sebagian setelah setoran pertama", async () => {
    await catatPembayaran(20_000_000);

    const t = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });
    expect(t.paid_amount.toString()).toBe("20000000");
    expect(t.status).toBe("partial");
    expect(d(t.grand_total).minus(d(t.paid_amount)).toString()).toBe("23325000");
  });

  it("menjadi lunas setelah pelunasan, tanpa sisa satu rupiah pun", async () => {
    await catatPembayaran(23_325_000);

    const t = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });
    expect(t.paid_amount.toString()).toBe("43325000");
    expect(t.status).toBe("paid");
    expect(d(t.grand_total).minus(d(t.paid_amount)).isZero()).toBe(true);
  });

  it("menghitung margin dari seluruh nilai tagihan, lalu menyimpannya utuh", async () => {
    const biaya = [
      { kategori: "hpp_bahan_baku", estimasi: 18_000_000, aktual: 19_250_000 },
      { kategori: "tenaga_kerja", estimasi: 4_500_000, aktual: null },
      { kategori: "sewa_peralatan", estimasi: 7_500_000, aktual: 7_500_000 },
    ];

    for (const b of biaya) {
      await prisma.invoice_costs.create({
        data: {
          invoice_id: jejak.tagihan!,
          category: b.kategori,
          description: `${TANDA} ${b.kategori}`,
          estimated_amount: String(b.estimasi),
          actual_amount: b.aktual === null ? null : String(b.aktual),
          status: b.aktual && b.aktual > 0 ? "aktual" : "estimasi",
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    const tagihan = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });
    const baris = await prisma.invoice_costs.findMany({
      where: { invoice_id: jejak.tagihan! },
    });

    const hasil = hitungMargin({
      penjualan: tagihan.grand_total.toString(),
      biaya: baris.map((b) => ({
        estimated_amount: b.estimated_amount?.toString() ?? null,
        actual_amount: b.actual_amount?.toString() ?? null,
      })),
    });

    // Yang diakui adalah grand total 43,325jt — seluruh uang yang diminta
    // dari customer, termasuk service charge dan PB1. Penyetoran PB1 dicatat
    // sebagai baris biaya, bukan dipotong diam-diam di dalam rumus.
    expect(hasil.net_sales.toString()).toBe("43325000");
    expect(hasil.total_cost.toString()).toBe("31250000"); // 19,25 + 4,5 + 7,5
    expect(hasil.profit.toString()).toBe("12075000");
    expect(hasil.margin_percent.toString()).toBe("27.87");
    expect(hasil.profit_status).toBe("untung");

    await prisma.invoice_margins.create({
      data: {
        invoice_id: jejak.tagihan!,
        net_sales: hasil.net_sales.toFixed(2),
        total_cost: hasil.total_cost.toFixed(2),
        profit: hasil.profit.toFixed(2),
        margin_percent: hasil.margin_percent.toFixed(2),
        profit_status: hasil.profit_status,
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const tersimpan = await prisma.invoice_margins.findUniqueOrThrow({
      where: { invoice_id: jejak.tagihan! },
    });
    expect(tersimpan.profit.toString()).toBe("12075000");
    expect(tersimpan.margin_percent.toString()).toBe("27.87");
  });

  it("memakai biaya aktual hanya bila di atas nol", async () => {
    const baris = await prisma.invoice_costs.findMany({
      where: { invoice_id: jejak.tagihan!, category: "tenaga_kerja" },
    });

    // Baris tenaga kerja tidak punya aktual, jadi estimasinya yang dipakai.
    expect(
      nilaiBiaya({
        estimated_amount: baris[0].estimated_amount?.toString() ?? null,
        actual_amount: baris[0].actual_amount?.toString() ?? null,
      }).toString(),
    ).toBe("4500000");
  });

  it("mengembalikan status ke belum-dibayar setelah pembayaran dihapus", async () => {
    for (const id of jejak.pembayaran) {
      await prisma.payment_details.deleteMany({ where: { payment_id: id } });
      await prisma.payments.delete({ where: { id } });
    }
    jejak.pembayaran = [];

    await hitungUlang();

    const t = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });
    expect(t.paid_amount.toString()).toBe("0");
    // Jatuh temponya masih di depan, jadi kembali ke belum-dibayar.
    expect(t.status).toBe("unpaid");
  });

  it("mengutamakan jatuh tempo di atas dibayar-sebagian, juga di database", async () => {
    // Jatuh tempo dimundurkan ke masa lalu, lalu dibayar sebagian.
    await prisma.invoices.update({
      where: { id: jejak.tagihan! },
      data: { due_date: new Date("2026-08-01") },
    });

    await catatPembayaran(5_000_000);

    const t = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });

    // Meskipun sudah ada uang masuk, statusnya tetap jatuh tempo — bukan
    // "partial". Urutan pemeriksaan ini dibawa apa adanya dari Laravel, dan
    // laporan piutang bergantung padanya.
    expect(t.paid_amount.toString()).toBe("5000000");
    expect(t.status).toBe("overdue");
  });

  it("tetap lunas walau jatuh temponya sudah lewat", async () => {
    await catatPembayaran(38_325_000);

    const t = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });
    expect(t.paid_amount.toString()).toBe("43325000");
    expect(t.status).toBe("paid");
  });
});

/* ------------------------------------------------------------------------- */

async function catatPembayaran(jumlah: number) {
  const tagihan = await prisma.invoices.findUniqueOrThrow({ where: { id: jejak.tagihan! } });

  const pembayaran = await prisma.payments.create({
    data: {
      payment_number: `UJI-PAY-${Date.now()}${Math.floor(Math.random() * 100)}`,
      payment_date: new Date("2026-09-11"),
      customer_id: tagihan.customer_id,
      payment_method: "transfer",
      total_amount: String(jumlah),
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pembayaran.push(pembayaran.id);

  await prisma.payment_details.create({
    data: {
      payment_id: pembayaran.id,
      invoice_id: tagihan.id,
      amount_applied: String(jumlah),
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  await hitungUlang();
}

/** Meniru persis apa yang dilakukan server setelah pembayaran berubah. */
async function hitungUlang() {
  const jumlah = await prisma.payment_details.aggregate({
    where: { invoice_id: jejak.tagihan! },
    _sum: { amount_applied: true },
  });

  const tagihan = await prisma.invoices.findUniqueOrThrow({
    where: { id: jejak.tagihan! },
    select: { status: true, grand_total: true, due_date: true },
  });

  const dibayar = d(jumlah._sum.amount_applied);

  await prisma.invoices.update({
    where: { id: jejak.tagihan! },
    data: {
      paid_amount: dibayar.toFixed(2),
      status: hitungStatusInvoice({
        statusSekarang: tagihan.status as StatusInvoice,
        grandTotal: tagihan.grand_total.toString(),
        totalDibayar: dibayar,
        dueDate: tagihan.due_date,
      }),
    },
  });
}
