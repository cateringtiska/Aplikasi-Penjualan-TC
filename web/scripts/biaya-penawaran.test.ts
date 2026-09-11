import { afterAll, describe, expect, it } from "vitest";

import { PENAWARAN_JADI_PERKIRAAN, salinPerkiraanBiaya } from "../lib/margin";
import { prisma } from "../lib/prisma";
import { d } from "../lib/uang";

/* ==========================================================================
   PERKIRAAN BIAYA PENAWARAN IKUT PINDAH KE TAGIHAN

   Biaya diperkirakan saat harga penawaran disusun. Ketika penawaran itu
   disetujui dan jadi tagihan, perkiraannya harus ikut — kalau tidak, orang
   harus mengetik ulang seluruh barisnya, dan yang paling mungkin terjadi
   adalah tidak ada yang mengetiknya sama sekali. Tagihan itu lalu terbaca
   untung 100% di laporan margin, dan angka laporannya diam-diam salah.

   Tiga hal yang dikunci di sini:

   1. Barisnya benar-benar tersalin.
   2. Hanya ESTIMASI yang tersalin, bukan aktual. Biaya aktual milik acara
      yang sudah terjadi; tagihan yang baru terbit belum punya angka nyata.
   3. Ringkasan margin ikut diperbarui pada saat yang sama. Ringkasan yang
      tertinggal adalah cara paling halus membuat laporan berbohong.

   Dijalankan di dalam transaksi dengan kolam koneksi satu — sekaligus
   membuktikan penyalinan ini tidak kena jebakan yang sama seperti penomoran
   dokumen dulu.
   ========================================================================== */

const TANDA = "UJI BIAYA PENAWARAN";

const jejak = {
  pelanggan: null as bigint | null,
  penawaran: null as bigint | null,
  tagihan: null as bigint | null,
};

afterAll(async () => {
  if (jejak.tagihan) {
    await prisma.invoice_margins.deleteMany({ where: { invoice_id: jejak.tagihan } });
    await prisma.invoice_costs.deleteMany({ where: { invoice_id: jejak.tagihan } });
    await prisma.invoices.delete({ where: { id: jejak.tagihan } }).catch(() => {});
  }
  if (jejak.penawaran) {
    await prisma.quotation_costs.deleteMany({ where: { quotation_id: jejak.penawaran } });
    await prisma.quotations.delete({ where: { id: jejak.penawaran } }).catch(() => {});
  }
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

describe("salinPerkiraanBiaya", () => {
  it("memindahkan estimasi penawaran ke tagihan, lalu memperbarui ringkasannya", async () => {
    const cap = Date.now().toString().slice(-6);
    const pengguna = await prisma.users.findFirstOrThrow({ select: { id: true } });

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJB-${cap}`,
        name: `${TANDA} Pelanggan`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.pelanggan = pelanggan.id;

    const penawaran = await prisma.quotations.create({
      data: {
        quotation_number: `UJB-QUO-${cap}`,
        customer_id: pelanggan.id,
        quotation_date: new Date(),
        valid_until: new Date(),
        subtotal: "10000000",
        grand_total: "11000000",
        status: "approved",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.penawaran = penawaran.id;

    await prisma.quotation_costs.createMany({
      data: [
        {
          quotation_id: penawaran.id,
          category: "hpp_bahan_baku",
          description: "Bahan baku buffet 300 pax",
          estimated_amount: "4000000",
          actual_amount: null,
          status: "estimasi",
          notes: "Vendor A",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          quotation_id: penawaran.id,
          category: "tenaga_kerja",
          description: "Waiter 6 orang",
          estimated_amount: "1500000",
          // Sengaja diisi: angka ini TIDAK boleh ikut ke tagihan baru.
          actual_amount: "1750000",
          status: "aktual",
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UJB-INV-${cap}`,
        quotation_id: penawaran.id,
        customer_id: pelanggan.id,
        invoice_date: new Date(),
        due_date: new Date(),
        subtotal: "10000000",
        grand_total: "11000000",
        status: "unpaid",
        paid_amount: "0",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.tagihan = tagihan.id;

    const jumlah = await prisma.$transaction((tx) =>
      salinPerkiraanBiaya(penawaran.id, tagihan.id, pengguna.id, tx),
    );
    expect(jumlah).toBe(2);

    const biaya = await prisma.invoice_costs.findMany({
      where: { invoice_id: tagihan.id },
      orderBy: { id: "asc" },
    });

    expect(biaya).toHaveLength(2);
    expect(biaya.map((b) => b.description)).toEqual([
      "Bahan baku buffet 300 pax",
      "Waiter 6 orang",
    ]);
    expect(biaya.map((b) => b.estimated_amount?.toString())).toEqual(["4000000", "1500000"]);
    expect(biaya[0].notes).toBe("Vendor A");

    // Inti nomor 2: aktual milik penawaran tidak ikut menyeberang.
    expect(biaya.every((b) => b.actual_amount === null)).toBe(true);
    expect(biaya.every((b) => b.status === "estimasi")).toBe(true);

    // Inti nomor 3: ringkasannya sudah ikut benar, bukan menunggu dibuka.
    const margin = await prisma.invoice_margins.findUniqueOrThrow({
      where: { invoice_id: tagihan.id },
    });
    expect(d(margin.total_cost).toFixed(0)).toBe("5500000");
    expect(d(margin.net_sales).toFixed(0)).toBe("10000000");
    expect(d(margin.profit).toFixed(0)).toBe("4500000");
    expect(d(margin.margin_percent).toFixed(0)).toBe("45");
    expect(margin.status).toBe("draft");
  });

  it("tidak membuat ringkasan palsu ketika penawarannya tidak berbiaya", async () => {
    const cap = `${Date.now().toString().slice(-5)}x`;
    const pengguna = await prisma.users.findFirstOrThrow({ select: { id: true } });

    const kosong = await prisma.quotations.create({
      data: {
        quotation_number: `UJB-QUO-${cap}`,
        customer_id: jejak.pelanggan!,
        quotation_date: new Date(),
        valid_until: new Date(),
        subtotal: "0",
        grand_total: "0",
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const jumlah = await prisma.$transaction((tx) =>
      salinPerkiraanBiaya(kosong.id, jejak.tagihan!, pengguna.id, tx),
    );

    expect(jumlah).toBe(0);
    await prisma.quotations.delete({ where: { id: kosong.id } });
  });
});

describe("PENAWARAN_JADI_PERKIRAAN", () => {
  it("meninggalkan penawaran yang sudah jadi tagihan", async () => {
    // jejak.penawaran sudah punya tagihan turunannya dari uji sebelumnya.
    const muncul = await prisma.quotations.findMany({
      where: { ...PENAWARAN_JADI_PERKIRAAN, id: jejak.penawaran! },
      select: { id: true },
    });

    // Kalau ini lolos masuk, satu acara terhitung DUA KALI di laporan:
    // sekali sebagai perkiraan, sekali lagi sebagai angka nyata.
    expect(muncul).toHaveLength(0);
  });

  it("tetap memuat penawaran yang belum jadi tagihan", async () => {
    const cap = `${Date.now().toString().slice(-5)}y`;
    const belum = await prisma.quotations.create({
      data: {
        quotation_number: `UJB-QUO-${cap}`,
        customer_id: jejak.pelanggan!,
        quotation_date: new Date(),
        valid_until: new Date(),
        subtotal: "1000000",
        grand_total: "1000000",
        status: "sent",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const muncul = await prisma.quotations.findMany({
      where: { ...PENAWARAN_JADI_PERKIRAAN, id: belum.id },
      select: { id: true },
    });
    expect(muncul).toHaveLength(1);

    // Ditolak berarti acaranya tidak akan terjadi.
    await prisma.quotations.update({
      where: { id: belum.id },
      data: { status: "rejected" },
    });
    const sesudahDitolak = await prisma.quotations.findMany({
      where: { ...PENAWARAN_JADI_PERKIRAAN, id: belum.id },
      select: { id: true },
    });
    expect(sesudahDitolak).toHaveLength(0);

    await prisma.quotations.delete({ where: { id: belum.id } });
  });
});
