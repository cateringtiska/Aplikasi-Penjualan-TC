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
  /** Nomor kolom menurut judulnya, dari baris kepala tabelnya. */
  function kolomKartu(lembar: ExcelJS.Worksheet, judul: string): number {
    const kepala = lembar.getRow(8);
    for (let i = 1; i <= kepala.cellCount; i += 1) {
      if (String(kepala.getCell(i).value ?? "").trim() === judul) return i;
    }
    throw new Error(`Kolom "${judul}" tidak ada.`);
  }

  async function lembarKartu(alamat = "http://localhost/laporan/piutang/excel") {
    const modul = await import("../app/(aplikasi)/laporan/piutang/excel/route");
    return (await unduh(modul, alamat)).getWorksheet("Kartu Piutang")!;
  }

  it("berbentuk buku besar: NO, tanggal, nomor, pelanggan, penjualan, uang muka, sisa, saldo", async () => {
    const lembar = await lembarKartu();
    expect(lembar.getCell("A1").value).toBe("Kartu Piutang");

    const kepala = lembar.getRow(8);
    const judul: string[] = [];
    for (let i = 1; i <= kepala.cellCount; i += 1) {
      judul.push(String(kepala.getCell(i).value ?? "").trim());
    }

    expect(judul).toEqual([
      "NO",
      "TANGGAL INVOICE",
      "NO INVOICE",
      "NAMA PELANGGAN",
      "PENJUALAN",
      "UANG MUKA/CICILAN",
      "SISA PELUNASAN",
      "SALDO",
    ]);
  });

  it("memuat invoice yang SAMA dengan layarnya, walaupun urutannya berbeda", async () => {
    /*
     * Urutannya sengaja berbeda: layar mengurutkan per customer supaya bisa
     * ditagih dengan satu telepon, berkas ini menurut terbitnya supaya
     * saldonya bisa ditelusuri. Yang tidak boleh berbeda adalah ISINYA,
     * jadi dibandingkan menurut nomor invoice — bukan posisi barisnya.
     */
    const { ambilPiutang } = await import("../lib/laporan-piutang");
    const { daftar } = await ambilPiutang("", {});
    if (daftar.length === 0) return;

    const lembar = await lembarKartu();
    const kNomor = kolomKartu(lembar, "NO INVOICE");

    const diBerkas: string[] = [];
    for (let i = 0; i < daftar.length; i += 1) {
      diBerkas.push(String(lembar.getRow(8 + 1 + i).getCell(kNomor).value ?? ""));
    }

    expect(diBerkas.slice().sort()).toEqual(daftar.map((p) => p.nomor).sort());
  });

  it("menulis angka TIAP BARIS sama persis dengan sumbernya", async () => {
    /*
     * Baris TOTAL saja tidak cukup. Totalnya dihitung dari sumber yang
     * sama, jadi ia tetap cocok walaupun setiap barisnya digeser — berkas
     * yang barisnya salah tetapi totalnya benar justru yang paling sulit
     * disadari, sebab yang pertama diperiksa orang adalah totalnya.
     */
    const { ambilPiutang } = await import("../lib/laporan-piutang");
    const { daftar } = await ambilPiutang("", {});
    if (daftar.length === 0) return;

    const { namaPelangganKartu } = await import(
      "../app/(aplikasi)/laporan/piutang/excel/route"
    );

    const lembar = await lembarKartu();
    const kNomor = kolomKartu(lembar, "NO INVOICE");
    const kNama = kolomKartu(lembar, "NAMA PELANGGAN");
    const kJual = kolomKartu(lembar, "PENJUALAN");
    const kMuka = kolomKartu(lembar, "UANG MUKA/CICILAN");
    const kSisa = kolomKartu(lembar, "SISA PELUNASAN");

    const sumber = new Map(daftar.map((p) => [p.nomor, p]));
    let diperiksa = 0;

    for (let i = 0; i < daftar.length; i += 1) {
      const baris = lembar.getRow(8 + 1 + i);
      const nomor = String(baris.getCell(kNomor).value ?? "");
      const p = sumber.get(nomor);
      expect(p, `baris ke-${i} memuat nomor asing: ${nomor}`).toBeDefined();
      if (!p) continue;

      expect(String(baris.getCell(kNama).value ?? ""), `nama ${nomor}`).toBe(
        namaPelangganKartu(p),
      );
      expect(Number(baris.getCell(kJual).value), `penjualan ${nomor}`).toBeCloseTo(
        Number(p.penjualan.toFixed(2)),
        2,
      );
      expect(Number(baris.getCell(kSisa).value), `sisa ${nomor}`).toBeCloseTo(
        Number(p.sisa.toFixed(2)),
        2,
      );

      // Uang muka DIKOSONGKAN ketika belum ada pembayaran. Nol terbaca
      // sebagai "sudah diperiksa, memang tidak ada".
      const muka = baris.getCell(kMuka).value;
      if (p.dibayar.gt(0)) {
        expect(Number(muka), `uang muka ${nomor}`).toBeCloseTo(Number(p.dibayar.toFixed(2)), 2);
      } else {
        expect(muka ?? "", `uang muka ${nomor} seharusnya kosong`).toBe("");
      }

      diperiksa += 1;
    }

    expect(diperiksa).toBe(daftar.length);
  });

  it("SALDO menumpuk, dan baris terakhirnya sama dengan total piutang", async () => {
    /*
     * Inti bentuk buku besar. Saldo yang tidak menumpuk hanya mengulang
     * kolom di sebelahnya, dan yang membacanya tidak punya cara mengetahui
     * berapa yang tertagih sampai baris tertentu.
     */
    const { ambilPiutang } = await import("../lib/laporan-piutang");
    const { daftar, totalSemua } = await ambilPiutang("", {});
    if (daftar.length === 0) return;

    const lembar = await lembarKartu();
    const kSisa = kolomKartu(lembar, "SISA PELUNASAN");
    const kSaldo = kolomKartu(lembar, "SALDO");

    let berjalan = 0;
    for (let i = 0; i < daftar.length; i += 1) {
      const baris = lembar.getRow(8 + 1 + i);
      berjalan += Number(baris.getCell(kSisa).value);

      expect(Number(baris.getCell(kSaldo).value), `saldo baris ke-${i + 1}`).toBeCloseTo(
        berjalan,
        2,
      );
    }

    expect(berjalan).toBeCloseTo(Number(totalSemua.toFixed(2)), 2);
  });

  it("diurutkan menurut nomor invoice, yaitu urutan terbitnya", async () => {
    // Saldo berjalan hanya bisa ditelusuri kalau barisnya berurutan terbit.
    const { ambilPiutang } = await import("../lib/laporan-piutang");
    const { daftar } = await ambilPiutang("", {});
    if (daftar.length < 2) return;

    const lembar = await lembarKartu();
    const kNomor = kolomKartu(lembar, "NO INVOICE");

    const nomor: string[] = [];
    for (let i = 0; i < daftar.length; i += 1) {
      nomor.push(String(lembar.getRow(8 + 1 + i).getCell(kNomor).value ?? ""));
    }

    expect(nomor).toEqual([...nomor].sort());
  });

  it("menomori barisnya 1, 2, 3 berurutan", async () => {
    const { ambilPiutang } = await import("../lib/laporan-piutang");
    const { daftar } = await ambilPiutang("", {});
    if (daftar.length === 0) return;

    const lembar = await lembarKartu();
    const kNo = kolomKartu(lembar, "NO");

    for (let i = 0; i < daftar.length; i += 1) {
      expect(Number(lembar.getRow(8 + 1 + i).getCell(kNo).value)).toBe(i + 1);
    }
  });

  it("memberi format rupiah pada kolom uang, bukan pada kolom teks", async () => {
    const lembar = await lembarKartu();

    for (const judul of ["PENJUALAN", "UANG MUKA/CICILAN", "SISA PELUNASAN", "SALDO"]) {
      expect(lembar.getColumn(kolomKartu(lembar, judul)).numFmt, judul).toContain("Rp");
    }

    // Nomor invoice dan tanggalnya teks. Format rupiah di situ mengubah
    // "INV-2026-0023" menjadi sesuatu yang tidak bisa dibaca.
    for (const judul of ["NO", "TANGGAL INVOICE", "NO INVOICE", "NAMA PELANGGAN"]) {
      expect(lembar.getColumn(kolomKartu(lembar, judul)).numFmt ?? "", judul).not.toContain("Rp");
    }
  });

  it("hanya membawa yang cocok ketika pencariannya diisi", async () => {
    const lembar = await lembarKartu(
      "http://localhost/laporan/piutang/excel?cari=TIDAK-ADA-YANG-BEGINI",
    );

    expect(String(lembar.getCell("A2").value)).toContain("TIDAK-ADA-YANG-BEGINI");
    expect(String(lembar.getRow(9).getCell(1).value ?? "")).toBe("TOTAL");
  });
});

/**
 * Nomor kolom menurut JUDULNYA, untuk lembar laporan margin.
 *
 * Nomornya pernah ditulis langsung di tes ini, dan menambah satu kolom
 * membuat tesnya menuduh hal yang salah — yang gugur adalah "uang bukan
 * angka", padahal yang bergeser letaknya.
 */
function kolomBerjudul(lembar: ExcelJS.Worksheet, judul: string): number {
  const kepala = lembar.getRow(7);
  for (let i = 1; i <= kepala.cellCount; i += 1) {
    if (String(kepala.getCell(i).value ?? "").trim() === judul) return i;
  }
  throw new Error("Kolom \"" + judul + "\" tidak ada di lembar " + lembar.name + ".");
}

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

    // Persentase TIDAK boleh diformat sebagai bilangan bulat. Nilainya
    // memang benar di dalam sel, tetapi format "#,##0" membuat margin 44,94%
    // TERTULIS 45 saat dibuka — berkas dan layar lalu menyebut angka berbeda
    // untuk hal yang sama, dan yang dipegang akuntan adalah berkasnya.
    expect(
      l1.getColumn(kolomBerjudul(l1, "Margin %")).numFmt,
      "kolom Margin % harus berdesimal",
    ).toBe("0.00");
    expect(
      l1.getColumn(kolomBerjudul(l1, "Margin")).numFmt,
      "kolom rupiah dibulatkan ke satuan",
    ).toBe("#,##0");
    expect(l1.getRow(6).getCell(4).numFmt, "ringkasan Margin % berdesimal").toBe("0.00");

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
      expect(l1.getRow(baris).getCell(kolomBerjudul(l1, "No. Invoice")).value).toBe(
        tanpaBiaya.nomor,
      );
      expect(l1.getRow(baris).getCell(kolomBerjudul(l1, "Biaya")).value).toBe("belum dicatat");
    }
  });
});

describe("PIC di laporan margin", () => {
  it("ikut tertulis di kedua lembarnya", async () => {
    // Dicari dari judulnya, bukan dari nomor kolomnya: yang dijaga adalah
    // keberadaan keterangannya, bukan di kolom keberapa ia kebetulan jatuh.
    const { ambilLaporanMargin } = await import("../lib/laporan-margin");
    const { nyata, perkiraan } = await ambilLaporanMargin("");

    const modul = await import("../app/(aplikasi)/laporan/margin/excel/route");
    const buku = await unduh(modul, "http://localhost/laporan/margin/excel");

    // Hanya kolom pic-nya yang dipakai di sini, jadi kedua bentuk barisnya
    // disamakan menjadi bentuk itu saja.
    const lembarUji: [string, { pic: string | null }[]][] = [
      ["Nyata - Invoice", nyata],
      ["Perkiraan - Quotation", perkiraan],
    ];

    for (const [namaLembar, baris] of lembarUji) {
      const lembar = buku.getWorksheet(namaLembar)!;
      const kolom = kolomBerjudul(lembar, "PIC");

      const berpic = baris.find((b) => b.pic);
      if (!berpic) continue;

      const nomorBaris = baris.indexOf(berpic) + 8;
      expect(
        lembar.getRow(nomorBaris).getCell(kolom).value,
        `PIC di ${namaLembar} tidak sama dengan yang di layar`,
      ).toBe(berpic.pic);
    }
  });

  it("dibiarkan KOSONG ketika memang tidak ada namanya", async () => {
    // Bukan tanda hubung atau "-": sel kosong terbaca sebagai "tidak ada
    // datanya", sedangkan tanda hubung ikut terbawa kalau kolomnya disalin
    // ke tempat lain.
    const { ambilLaporanMargin } = await import("../lib/laporan-margin");
    const { nyata } = await ambilLaporanMargin("");

    const tanpaPic = nyata.find((b) => !b.pic);
    if (!tanpaPic) return;

    const modul = await import("../app/(aplikasi)/laporan/margin/excel/route");
    const buku = await unduh(modul, "http://localhost/laporan/margin/excel");
    const lembar = buku.getWorksheet("Nyata - Invoice")!;

    const nilai = lembar
      .getRow(nyata.indexOf(tanpaPic) + 8)
      .getCell(kolomBerjudul(lembar, "PIC")).value;

    expect(nilai ?? "").toBe("");
  });
});

describe("siapa yang disebut sebagai PIC", () => {
  it("KONTAK DOKUMENNYA yang menang, bukan PIC tetap customernya", async () => {
    /*
     * Dua nama tersimpan di tempat berbeda, dan keduanya sering terisi
     * sekaligus. Menukar urutannya tidak menimbulkan galat apa pun: laporan
     * tetap terbuka, kolomnya tetap terisi, hanya namanya yang salah orang.
     *
     * Tes sebelumnya tidak bisa menangkapnya — ia membandingkan isi Excel
     * dengan ambilLaporanMargin(), jadi kalau aturannya sendiri yang
     * tertukar, keduanya tertukar bersama dan tetap cocok. Karena itu di
     * sini datanya dibuat sendiri, dengan dua nama yang sengaja berbeda.
     */
    const cap = Date.now().toString().slice(-6);
    const { ambilLaporanMargin } = await import("../lib/laporan-margin");

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UPIC-${cap}`,
        name: `UJI PIC Pelanggan ${cap}`,
        pic_name: "Nama Tetap Di Customer",
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UPIC-INV-${cap}`,
        customer_id: pelanggan.id,
        contact_person: "Nama Di Dokumen Ini",
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86_400_000),
        subtotal: "1000000",
        grand_total: "1000000",
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    try {
      const { nyata } = await ambilLaporanMargin(`UPIC-INV-${cap}`);
      const baris = nyata.find((b) => b.nomor === `UPIC-INV-${cap}`);

      expect(baris, "invoice ujinya tidak terbawa laporan").toBeDefined();
      expect(
        baris!.pic,
        "yang ditelepon untuk invoice ini adalah nama yang tertulis di invoice ini",
      ).toBe("Nama Di Dokumen Ini");
    } finally {
      await prisma.invoices.delete({ where: { id: tagihan.id } });
      await prisma.customers.delete({ where: { id: pelanggan.id } });
    }
  });

  it("memakai PIC customernya ketika dokumennya tidak menyebut siapa pun", async () => {
    const cap = Date.now().toString().slice(-6);
    const { ambilLaporanMargin } = await import("../lib/laporan-margin");

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UPIC2-${cap}`,
        name: `UJI PIC Pelanggan Dua ${cap}`,
        pic_name: "Nama Tetap Di Customer",
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UPIC2-INV-${cap}`,
        customer_id: pelanggan.id,
        contact_person: null,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86_400_000),
        subtotal: "1000000",
        grand_total: "1000000",
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    try {
      const { nyata } = await ambilLaporanMargin(`UPIC2-INV-${cap}`);
      const baris = nyata.find((b) => b.nomor === `UPIC2-INV-${cap}`);
      expect(baris!.pic).toBe("Nama Tetap Di Customer");
    } finally {
      await prisma.invoices.delete({ where: { id: tagihan.id } });
      await prisma.customers.delete({ where: { id: pelanggan.id } });
    }
  });
});
