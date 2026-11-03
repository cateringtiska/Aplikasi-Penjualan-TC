import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { type InvoiceRincian, barisRincian, judulBulan, tambahLembarRincian } from "./excel-rincian";

/* Lembar "Rincian Item": yang dikunci adalah angkanya — subtotal tiap blok
   harus sama dengan total invoice, dan grand total sama dengan jumlah
   semuanya. Warnanya bebas berubah. */

const GLADYS: InvoiceRincian = {
  nomor: "INV-2026-0004",
  tanggal: new Date("2026-08-01"),
  sales: "ari",
  pelanggan: "Ibu Gladys - PT. CIBES LIFT INDONESIA",
  items: [
    { nama: "Morning Coffee - Tea - Snacks", qty: "25", harga: "70000", total: "1750000" },
    { nama: "Lunch Mini Buffet - Nasi Daun Jeruk", qty: "25", harga: "160000", total: "4000000" },
  ],
  serviceCharge: "2500000",
  pb1: "575000",
  delivery: "0",
  biayaTambahan: [],
  total: "8825000",
};

const AYU: InvoiceRincian = {
  nomor: "INV-2026-0001",
  tanggal: new Date("2026-08-01"),
  sales: "ida",
  pelanggan: "Ibu Ayu",
  items: [{ nama: "Lasagna Ukuran 20x20", qty: "1", harga: "300000", total: "300000" }],
  serviceCharge: "0",
  pb1: "0",
  delivery: "30000",
  biayaTambahan: [{ label: "Sewa alat", nilai: "50000" }],
  total: "380000",
};

describe("barisRincian", () => {
  it("menambahkan pos di luar item sebagai baris, dan melewatkan yang nol", () => {
    const b = barisRincian(GLADYS).map((x) => x.uraian);
    expect(b).toEqual([
      "Morning Coffee - Tea - Snacks",
      "Lunch Mini Buffet - Nasi Daun Jeruk",
      "Service Charge",
      "PB1",
    ]);
    expect(barisRincian(AYU).map((x) => x.uraian)).toEqual([
      "Lasagna Ukuran 20x20",
      "Delivery Service",
      "Sewa alat",
    ]);
  });

  it("jumlah barisnya sama dengan total invoice", () => {
    for (const inv of [GLADYS, AYU]) {
      const jumlah = barisRincian(inv).reduce((j, b) => j + b.total, 0);
      expect(jumlah).toBe(Number(inv.total));
    }
  });
});

describe("tambahLembarRincian", () => {
  it("subtotal per invoice dan grand total tercetak sebagai angka", () => {
    const buku = new ExcelJS.Workbook();
    const lembar = tambahLembarRincian(buku, {
      invoices: [AYU, GLADYS],
      namaPerusahaan: "Tiska Catering",
      periode: "Bulan Agustus 2026",
    });

    const nilai = (teks: string) => {
      const hasil: unknown[] = [];
      lembar.eachRow((r) => {
        if (r.getCell(8).value === teks) hasil.push(r.getCell(9).value);
      });
      return hasil;
    };

    expect(nilai("Subtotal")).toEqual([380000, 8825000]);
    expect(nilai("GRAND TOTAL")).toEqual([9205000]);
    expect(lembar.getCell("A1").value).toBe("LAPORAN PENJUALAN TISKA CATERING");
    expect(lembar.getCell("A3").value).toBe("BULAN AGUSTUS 2026");
  });
});

describe("judulBulan", () => {
  it("menyebut bulannya kalau rentangnya tepat satu bulan penuh", () => {
    expect(judulBulan("2026-08-01", "2026-08-31", "x")).toBe("Bulan Agustus 2026");
    expect(judulBulan("2026-02-01", "2026-02-28", "x")).toBe("Bulan Februari 2026");
  });
  it("selain itu memakai periodenya", () => {
    expect(judulBulan("", "", "Semua periode")).toBe("Semua periode");
    expect(judulBulan("2026-08-05", "2026-08-31", "x")).toMatch(/^Periode 5 Agt 2026/);
  });
});
