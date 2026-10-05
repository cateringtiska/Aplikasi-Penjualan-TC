import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buatBukuPenjualan } from "../lib/excel-penjualan";
import { ambilLaporan } from "../lib/laporan-penjualan";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   LAPORAN PENJUALAN DALAM BENTUK EXCEL

   Berkas ini diserahkan ke orang yang MENJURNAL. Yang dikunci di sini bukan
   warnanya, melainkan dua hal yang kalau salah akan merusak pembukuan tanpa
   terlihat salah:

   1. RINCIANNYA MENJUMLAH TEPAT KE TOTAL INVOICE. Penjualan, service charge,
      PB1, delivery, dan biaya tambahan adalah pos yang perlakuannya berbeda;
      kalau jumlahnya tidak sama dengan totalnya, ada nilai yang dijurnal dua
      kali atau tidak sama sekali. Selisihnya ikut DICETAK, supaya yang
      membaca berkasnya bisa memeriksanya sendiri.

   2. ANGKANYA DITULIS SEBAGAI ANGKA, bukan teks. Angka yang tersimpan
      sebagai teks tidak bisa dijumlah di Excel — dan diam-diam menjumlah
      menjadi nol, yang terbaca seperti tidak ada transaksi.
   ========================================================================== */

const TANDA = "UJI EXCEL PENJUALAN";

const jejak = { pelanggan: null as bigint | null, tagihan: null as bigint | null };

const hari = (selisih: number) => {
  const t = new Date();
  t.setUTCHours(0, 0, 0, 0);
  t.setUTCDate(t.getUTCDate() + selisih);
  return t;
};

beforeAll(async () => {
  const cap = Date.now().toString().slice(-6);

  const pelanggan = await prisma.customers.create({
    data: {
      customer_code: `UJX-${cap}`,
      name: `${TANDA} Pelanggan`,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pelanggan = pelanggan.id;

  // Satu invoice yang memuat KELIMA pos sekaligus, supaya penjumlahannya
  // benar-benar diuji: 8jt + 1,6jt + 800rb + 250rb + 350rb = 11.000.000
  const t = await prisma.invoices.create({
    data: {
      invoice_number: `UJX-INV-${cap}`,
      customer_id: pelanggan.id,
      invoice_date: hari(-5),
      due_date: hari(25),
      subtotal: "8000000",
      service_charge_amount: "1600000",
      pb1_enabled: true,
      pb1_amount: "800000",
      delivery_amount: "250000",
      grand_total: "11000000",
      paid_amount: "0",
      status: "unpaid",
      event_date: hari(-2),
      event_days: 1,
      created_at: new Date(),
      updated_at: new Date(),
      invoice_charges: {
        create: [
          {
            label: "Tim servis",
            amount: "350000",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      },
    },
  });
  jejak.tagihan = t.id;
});

afterAll(async () => {
  await prisma.invoices.deleteMany({ where: { invoice_number: { startsWith: "UJX-" } } });
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

async function buatBuku() {
  const { baris } = await ambilLaporan({ dari: "", sampai: "", pelanggan: "" }, {});
  const buku = await buatBukuPenjualan({
    baris,
    periode: "Semua periode",
    perusahaan: { nama: "PT. Tiska Cipta Imaji", logo: null },
    dicetakOleh: "reza",
  });

  // Ditulis lalu DIBACA ULANG, bukan diperiksa dari objek di memori: yang
  // sampai ke orang adalah berkasnya, bukan objeknya.
  const isi = await buku.xlsx.writeBuffer();
  const dibaca = new ExcelJS.Workbook();
  await dibaca.xlsx.load(isi as ArrayBuffer);
  return dibaca;
}

describe("berkas Excel laporan penjualan", () => {
  it("punya satu lembar untuk tiap keadaan pengakuan", async () => {
    const buku = await buatBuku();

    // Lembar kosong tetap ada: lembar yang hilang terbaca sebagai laporan
    // yang tidak lengkap.
    expect(buku.worksheets.map((l) => l.name)).toEqual([
      "Penjualan",
      "Uang muka",
      "Diterima di muka",
      "Proyeksi",
    ]);
  });

  it("memecah nilainya menjadi pos-pos yang berbeda perlakuannya", async () => {
    const buku = await buatBuku();
    const lembar = buku.getWorksheet("Penjualan")!;

    const baris = cariBaris(lembar, "UJX-INV-");
    expect(baris, "baris ujinya tidak ketemu").not.toBeNull();

    expect(baris!.getCell(8).value).toBe(8_000_000); // Penjualan
    expect(baris!.getCell(9).value).toBe(1_600_000); // Service charge
    expect(baris!.getCell(10).value).toBe(800_000); // PB1
    expect(baris!.getCell(11).value).toBe(250_000); // Delivery
    expect(baris!.getCell(12).value).toBe(350_000); // Biaya tambahan
    expect(baris!.getCell(13).value).toBe(11_000_000); // Total invoice
  });

  it("RINCIANNYA MENJUMLAH TEPAT ke total invoice", async () => {
    const buku = await buatBuku();

    // Diperiksa pada SELURUH baris di seluruh lembar, bukan hanya baris uji.
    for (const lembar of buku.worksheets) {
      lembar.eachRow((baris) => {
        const nomor = baris.getCell(1).value;
        if (typeof nomor !== "string" || !nomor.includes("INV")) return;

        const pecahan = [8, 9, 10, 11, 12].reduce(
          (jumlah, k) => jumlah + Number(baris.getCell(k).value ?? 0),
          0,
        );
        const total = Number(baris.getCell(13).value ?? 0);

        expect(pecahan, `${nomor} di lembar ${lembar.name}`).toBe(total);
        expect(Number(baris.getCell(14).value ?? 0), `selisih ${nomor}`).toBe(0);
      });
    }
  });

  it("menulis uang sebagai ANGKA, bukan teks", async () => {
    const buku = await buatBuku();
    const lembar = buku.getWorksheet("Penjualan")!;
    const baris = cariBaris(lembar, "UJX-INV-")!;

    for (const kolom of [8, 9, 10, 11, 12, 13, 15, 16, 17]) {
      expect(typeof baris.getCell(kolom).value, `kolom ${kolom}`).toBe("number");
    }
  });

  it("memberi format rupiah pada kolom uangnya", async () => {
    // Nilainya sudah benar sebagai angka; yang diuji di sini bentuk bacanya.
    const buku = await buatBuku();
    const lembar = buku.getWorksheet("Penjualan")!;
    expect(lembar.getColumn(8).numFmt).toContain("Rp");
  });

  it("membekukan kepala tabel dan memasang saringan", async () => {
    const buku = await buatBuku();
    const lembar = buku.getWorksheet("Penjualan")!;

    expect(lembar.views[0]?.state).toBe("frozen");
    expect(lembar.autoFilter).toBeTruthy();
  });
});

/** Baris pertama yang nomor invoicenya berawalan ini. */
function cariBaris(lembar: ExcelJS.Worksheet, awalan: string): ExcelJS.Row | null {
  let hasil: ExcelJS.Row | null = null;
  lembar.eachRow((baris) => {
    const nomor = baris.getCell(1).value;
    if (hasil === null && typeof nomor === "string" && nomor.startsWith(awalan)) {
      hasil = baris;
    }
  });
  return hasil;
}
