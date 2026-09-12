// @vitest-environment node

import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";

import { prisma } from "../lib/prisma";

/* ==========================================================================
   BERKAS EXCEL YANG DIUNDUH HARUS BENAR-BENAR BISA DIBUKA

   Rute yang lolos TypeScript tetap bisa menghasilkan berkas rusak, atau
   berkas rapi berisi angka yang salah. Keduanya baru ketahuan saat berkasnya
   sudah dikirim ke akuntan.

   Jadi di sini berkasnya benar-benar DIBUAT, lalu DIBACA ULANG dengan
   ExcelJS dan isinya dicocokkan sel demi sel dengan data di database.

   Dua hal yang paling dijaga:

   1. Uang ditulis sebagai ANGKA, bukan teks. Kolom berisi teks "1.000.000"
      tidak bisa dijumlah di Excel, dan orang yang menerimanya baru sadar
      setelah menyorot satu kolom penuh dan melihat hasilnya nol.

   2. Laporan margin punya DUA lembar terpisah. Angka nyata dan angka
      perkiraan tidak boleh berada di lembar yang sama — di sana keduanya
      terlalu mudah tersorot bersama lalu dijumlahkan menjadi angka yang
      tidak berarti apa-apa.
   ========================================================================== */

vi.mock("@/lib/auth", () => ({
  penggunaAktif: async () => ({
    id: "1",
    nama: "Reza",
    username: "reza",
    email: null,
    peran: "admin",
  }),
}));

afterAll(async () => {
  await prisma.$disconnect();
});

/** Menjalankan satu rute unduhan dan membuka hasilnya sebagai buku kerja. */
async function unduh(
  modul: { GET: (r: NextRequest) => Promise<Response> },
  alamat: string,
) {
  const { NextRequest: Permintaan } = await import("next/server");
  const tanggapan = await modul.GET(new Permintaan(new URL(alamat)));

  expect(tanggapan.status).toBe(200);
  expect(tanggapan.headers.get("Content-Type")).toContain("spreadsheetml");
  expect(tanggapan.headers.get("Content-Disposition")).toContain(".xlsx");
  // Tidak boleh singgah di cache mana pun: isinya angka keuangan.
  expect(tanggapan.headers.get("Cache-Control")).toBe("no-store");

  const buku = new ExcelJS.Workbook();
  await buku.xlsx.load(await tanggapan.arrayBuffer());
  return buku;
}

describe("unduhan kartu piutang", () => {
  it("menghasilkan berkas yang bisa dibuka, dengan uang sebagai angka", async () => {
    const modul = await import("../app/(aplikasi)/laporan/piutang/excel/route");
    const buku = await unduh(modul, "http://localhost/laporan/piutang/excel");

    const lembar = buku.getWorksheet("Kartu Piutang");
    expect(lembar, "lembar Kartu Piutang harus ada").toBeDefined();
    expect(lembar!.getCell("A1").value).toBe("Kartu Piutang");

    // Ringkasan umur piutang di baris 5 harus berupa angka, bukan teks.
    for (let i = 1; i <= 4; i++) {
      expect(typeof lembar!.getRow(5).getCell(i).value).toBe("number");
    }

    // Baris 8 adalah kepala tabel.
    expect(lembar!.getRow(8).getCell(1).value).toBe("Kode Customer");
    expect(lembar!.getRow(8).getCell(6).value).toBe("Sisa Piutang");
  });

  it("mencocokkan jumlah barisnya dengan isi database", async () => {
    const { ambilPiutang } = await import("../lib/laporan-piutang");
    const { daftar, totalSemua } = await ambilPiutang("");

    const modul = await import("../app/(aplikasi)/laporan/piutang/excel/route");
    const lembar = (await unduh(modul, "http://localhost/laporan/piutang/excel")).getWorksheet(
      "Kartu Piutang",
    )!;

    // Baris 8 kepala, lalu satu baris per customer, lalu satu baris TOTAL.
    const barisTotal = lembar.getRow(8 + daftar.length + 1);
    expect(barisTotal.getCell(1).value).toBe("TOTAL");
    expect(barisTotal.getCell(2).value).toBe(`${daftar.length} customer`);
    expect(Number(barisTotal.getCell(6).value)).toBeCloseTo(Number(totalSemua.toFixed(2)), 2);
  });

  it("hanya membawa yang cocok ketika pencariannya diisi", async () => {
    const modul = await import("../app/(aplikasi)/laporan/piutang/excel/route");
    const lembar = (
      await unduh(modul, "http://localhost/laporan/piutang/excel?cari=TIDAK-ADA-YANG-BEGINI")
    ).getWorksheet("Kartu Piutang")!;

    expect(lembar.getRow(9).getCell(1).value).toBe("TOTAL");
    expect(lembar.getRow(9).getCell(2).value).toBe("0 customer");
  });
});

describe("unduhan laporan margin", () => {
  it("memisahkan angka nyata dan perkiraan ke DUA lembar", async () => {
    const modul = await import("../app/(aplikasi)/laporan/margin/excel/route");
    const buku = await unduh(modul, "http://localhost/laporan/margin/excel");

    const nama = buku.worksheets.map((w) => w.name);
    expect(nama).toEqual(["Nyata - Invoice", "Perkiraan - Quotation"]);

    // Peringatannya harus tertulis di lembar perkiraan, bukan hanya di layar:
    // berkas ini akan dibuka orang lain, di tempat lain, tanpa layar itu.
    const catatan = String(buku.getWorksheet("Perkiraan - Quotation")!.getCell("A3").value);
    expect(catatan).toContain("jangan dijumlahkan");
  });

  it("menulis angka margin yang sama dengan yang dihitung aplikasi", async () => {
    const { ambilLaporanMargin } = await import("../lib/laporan-margin");
    const { nyata, ringkasanNyata, ringkasanPerkiraan } = await ambilLaporanMargin("");

    const modul = await import("../app/(aplikasi)/laporan/margin/excel/route");
    const buku = await unduh(modul, "http://localhost/laporan/margin/excel");

    const l1 = buku.getWorksheet("Nyata - Invoice")!;
    expect(Number(l1.getRow(6).getCell(1).value)).toBeCloseTo(
      Number(ringkasanNyata.penjualan.toFixed(2)),
      2,
    );
    expect(Number(l1.getRow(6).getCell(3).value)).toBeCloseTo(
      Number(ringkasanNyata.untung.toFixed(2)),
      2,
    );

    const l2 = buku.getWorksheet("Perkiraan - Quotation")!;
    expect(Number(l2.getRow(6).getCell(3).value)).toBeCloseTo(
      Number(ringkasanPerkiraan.untung.toFixed(2)),
      2,
    );

    // Tagihan tanpa catatan biaya ditulis "belum dicatat", BUKAN angka nol.
    // Nol berarti "biayanya memang nol"; keduanya sangat berbeda artinya bagi
    // orang yang membaca laporan ini untuk menentukan harga.
    const tanpaBiaya = nyata.find((b) => !b.adaBiaya);
    if (tanpaBiaya) {
      const baris = nyata.indexOf(tanpaBiaya) + 8;
      expect(l1.getRow(baris).getCell(1).value).toBe(tanpaBiaya.nomor);
      expect(l1.getRow(baris).getCell(6).value).toBe("belum dicatat");
    }
  });
});
