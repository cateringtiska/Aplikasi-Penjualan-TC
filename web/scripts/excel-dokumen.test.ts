import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";

import { barisTabelDokumen, barisTotalDokumen } from "../lib/baris-cetak";
import { buatExcelDokumen, namaBerkasDokumen } from "../lib/excel-dokumen";
import { isiDokumenTagihan, isiDokumenPenawaran } from "../lib/isi-dokumen";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   BERKAS EXCEL HARUS SAMA ISINYA DENGAN KERTASNYA

   Customer meminta rincian dokumennya dalam Excel untuk dicocokkan dengan
   anggarannya sendiri. Jadi ada DUA bentuk dari satu pesanan yang sama, dan
   keduanya dikirimkan ke orang yang sama.

   Kalau keduanya menyusun barisnya sendiri-sendiri, cepat atau lambat
   kertas dan berkasnya akan menyebut angka berbeda — dan itu TIDAK AKAN
   TERLIHAT dari layar mana pun. Yang menemukannya adalah customer, saat
   menagih atau membayar.

   Karena itu susunan barisnya diambil dari lib/baris-cetak.ts dan datanya
   dari lib/isi-dokumen.ts, keduanya dipakai bersama. Tes ini yang menjaga
   bahwa pemisahan itu benar-benar berlaku, bukan sekadar niat.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

/** Nomor baris kepala tabel rincian, dikenali dari isinya. */
function barisKepala(lembar: ExcelJS.Worksheet): number {
  for (let i = 1; i <= lembar.rowCount; i += 1) {
    if (String(lembar.getRow(i).getCell(1).value ?? "").trim() === "No") return i;
  }
  throw new Error("Baris kepala tabel rincian tidak ketemu.");
}

async function lembarDari(isi: Awaited<ReturnType<typeof isiDokumenTagihan>>) {
  const berkas = await buatExcelDokumen(isi!);
  const buku = new ExcelJS.Workbook();
  await buku.xlsx.load(berkas);
  return buku.worksheets[0];
}

/** Invoice dengan rincian terbanyak — yang paling mungkin memuat judul kelompok. */
async function tagihanTeruji() {
  const daftar = await prisma.invoices.findMany({
    where: { status: { not: "cancelled" } },
    select: { id: true, _count: { select: { invoice_items: true } } },
    orderBy: { id: "desc" },
    take: 30,
  });

  const terpilih = daftar.sort((a, b) => b._count.invoice_items - a._count.invoice_items)[0];
  expect(terpilih, "tidak ada invoice untuk diuji").toBeDefined();
  return terpilih.id.toString();
}

describe("baris Excel mengikuti baris kertasnya", () => {
  it("jumlah dan urutan barisnya sama persis", async () => {
    const id = await tagihanTeruji();
    const isi = await isiDokumenTagihan(id, {});
    expect(isi).not.toBeNull();

    const diharapkan = barisTabelDokumen(isi!.baris);
    const lembar = await lembarDari(isi);
    const mulai = barisKepala(lembar) + 1;

    diharapkan.forEach((b, i) => {
      const baris = lembar.getRow(mulai + i);

      if (b.jenis === "totalKelompok") {
        expect(String(baris.getCell(1).value ?? ""), `baris ke-${i}`).toBe(b.label);
        expect(Number(baris.getCell(7).value), b.label).toBeCloseTo(b.nilaiAngka, 2);
        return;
      }

      expect(String(baris.getCell(1).value ?? ""), `nomor baris ke-${i}`).toBe(b.nomor);
      expect(String(baris.getCell(2).value ?? ""), `nama baris ke-${i}`).toContain(b.nama);
    });
  });

  it("baris JUDUL kelompok dikosongkan kolom angkanya, bukan diisi nol", async () => {
    // Nol terbaca sebagai harga, dan pembacanya akan mencari-cari apa yang
    // berharga nol. Di Excel kesalahan ini lebih buruk lagi: nol ikut
    // terbawa kalau kolomnya dijumlah.
    const id = await tagihanTeruji();
    const isi = await isiDokumenTagihan(id, {});

    const diharapkan = barisTabelDokumen(isi!.baris);
    const judul = diharapkan.filter((b) => b.jenis === "item" && b.judul);
    if (judul.length === 0) return;

    const lembar = await lembarDari(isi);
    const mulai = barisKepala(lembar) + 1;

    diharapkan.forEach((b, i) => {
      if (b.jenis !== "item" || !b.judul) return;
      const baris = lembar.getRow(mulai + i);

      for (const kolom of [3, 4, 6, 7]) {
        const nilai = baris.getCell(kolom).value;
        expect(nilai ?? "", `${b.nama} kolom ${kolom}`).toBe("");
      }
    });
  });

  it("uang ditulis sebagai ANGKA, supaya bisa dijumlah", async () => {
    // Berkas yang angkanya berupa teks "Rp 1.520.000" tidak bisa dijumlah
    // sama sekali, dan yang membukanya akan mengetik ulang seluruh kolomnya.
    const id = await tagihanTeruji();
    const isi = await isiDokumenTagihan(id, {});

    const diharapkan = barisTabelDokumen(isi!.baris);
    const lembar = await lembarDari(isi);
    const mulai = barisKepala(lembar) + 1;

    let diperiksa = 0;
    diharapkan.forEach((b, i) => {
      if (b.jenis !== "item" || b.nilaiAngka === null) return;
      const sel = lembar.getRow(mulai + i).getCell(7);

      expect(typeof sel.value, `${b.nama} nilainya bukan angka`).toBe("number");
      expect(Number(sel.value)).toBeCloseTo(b.nilaiAngka, 2);
      expect(sel.numFmt, `${b.nama} tanpa format rupiah`).toContain("Rp");
      diperiksa += 1;
    });

    expect(diperiksa, "tidak ada satu pun baris berharga yang terperiksa").toBeGreaterThan(0);
  });
});

describe("blok total", () => {
  it("TOTAL-nya sama dengan grand total invoice-nya", async () => {
    const id = await tagihanTeruji();
    const isi = await isiDokumenTagihan(id, {});

    const total = barisTotalDokumen(isi!);
    const lembar = await lembarDari(isi);

    const mulai = barisKepala(lembar) + 1 + barisTabelDokumen(isi!.baris).length;

    total.forEach((b, i) => {
      const baris = lembar.getRow(mulai + i);
      expect(String(baris.getCell(1).value ?? ""), `label total ke-${i}`).toBe(b.label);
      expect(Number(baris.getCell(7).value), b.label).toBeCloseTo(b.nilaiAngka, 2);
    });

    const terakhir = total[total.length - 1];
    expect(terakhir.label).toBe("TOTAL");
    expect(terakhir.nilaiAngka).toBeCloseTo(Number(isi!.grand_total), 2);
  });
});

describe("quotation ikut bisa diunduh", () => {
  it("menghasilkan berkas yang bisa dibuka, berjudul Quotation", async () => {
    const satu = await prisma.quotations.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (!satu) return;

    const isi = await isiDokumenPenawaran(satu.id.toString(), {});
    expect(isi).not.toBeNull();
    expect(isi!.judul).toBe("Quotation");

    const lembar = await lembarDari(isi);
    expect(barisKepala(lembar)).toBeGreaterThan(0);
  });
});

describe("nama berkasnya", () => {
  it("memakai nomor dokumennya, supaya tidak tertukar di folder unduhan", () => {
    // "dokumen (3).xlsx" di folder unduhan tidak memberi tahu apa pun
    // tentang isinya, dan dokumen ini dikirim ke customer.
    const nama = namaBerkasDokumen("INV-2026-0026", new Date("2026-10-08T00:00:00"));
    expect(nama).toBe("INV-2026-0026-20261008.xlsx");
  });

  it("membuang tanda yang tidak boleh ada di nama berkas", () => {
    expect(namaBerkasDokumen("INV/2026 #26", new Date("2026-10-08T00:00:00"))).toBe(
      "INV-2026-26-20261008.xlsx",
    );
  });
});
