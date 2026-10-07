import { afterAll, describe, expect, it } from "vitest";

import { tanggalAcaraUntukFormulir } from "../lib/pilihan";
import { prisma } from "../lib/prisma";
import { jumlahHariAcara, ringkasTanggalAcara } from "../lib/tanggal";
import { tulisTanggalAcaraTagihan } from "../lib/tanggal-acara";

/* ==========================================================================
   TANGGAL ACARA YANG LEBIH DARI SATU

   Satu dokumen bisa menanggung acara 1-4 hari, dan tanggalnya tidak selalu
   berurutan: 10, 12, lalu 15 Mei. Satu kolom tanggal ditambah satu kolom
   "jumlah hari" tidak bisa menyatakan itu.

   Yang dibuktikan di sini hanya yang tampak di database sungguhan — bentuk
   kalimatnya sendiri sudah dikunci lib/tanggal.test.ts:

   1. TANGGALNYA TIDAK BERGESER SEHARI. Kolomnya bertipe DATE, dan tanggal
      yang dibuat dari tengah malam SETEMPAT akan tersimpan mundur sehari di
      zona waktu timur. Dokumennya tetap terbit, hanya menyebutkan hari yang
      salah — dan itu baru ketahuan ketika orang katering datang pada hari
      yang keliru.

   2. MENIMPA, BUKAN MENAMBAH. Baris yang menumpuk membuat jumlah hari
      terbaca lebih banyak daripada yang benar-benar terjadi.

   3. DOKUMEN LAMA TIDAK KEHILANGAN TANGGALNYA. Dokumen yang dibuat sebelum
      tanggal menjadi daftar hanya punya kolom lamanya; membukanya dengan
      daftar kosong lalu menyimpannya akan menghapus tanggal acaranya tanpa
      peringatan apa pun.
   ========================================================================== */

const TANDA = "UJI TANGGAL ACARA";

const jejak = { pelanggan: null as bigint | null, tagihan: null as bigint | null };

afterAll(async () => {
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

/** Dibaca sebagai tengah malam UTC — bentuk yang dipakai siapkanDokumen. */
const tgl = (teks: string) => new Date(teks);

describe("tanggal acara tersimpan", () => {
  it("pulang dengan tanggal yang sama persis, tidak bergeser sehari", async () => {
    const cap = Date.now().toString().slice(-6);

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJA-${cap}`,
        name: `${TANDA} Pelanggan`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.pelanggan = pelanggan.id;

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UJA-INV-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: new Date(),
        due_date: new Date(),
        subtotal: "0",
        grand_total: "0",
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak.tagihan = tagihan.id;

    // Sengaja MELONCAT, dan sengaja tidak urut saat dikirim.
    const dikirim = [tgl("2026-05-15"), tgl("2026-05-10"), tgl("2026-05-12")];
    const jumlah = await prisma.$transaction((tx) =>
      tulisTanggalAcaraTagihan(jejak.tagihan!, dikirim, tx),
    );
    expect(jumlah).toBe(3);

    const tersimpan = await prisma.invoice_event_dates.findMany({
      where: { invoice_id: jejak.tagihan! },
      orderBy: { event_date: "asc" },
      select: { event_date: true },
    });

    expect(tersimpan.map((b) => b.event_date.toISOString().slice(0, 10))).toEqual([
      "2026-05-10",
      "2026-05-12",
      "2026-05-15",
    ]);

    const daftar = tersimpan.map((b) => b.event_date);
    expect(ringkasTanggalAcara(daftar)).toBe("Minggu 10, Selasa 12 & Jumat 15 Mei 2026");
    expect(jumlahHariAcara(daftar)).toBe(3);
  });

  it("MENIMPA, bukan menambah, ketika dokumennya disimpan ulang", async () => {
    const dua = [tgl("2026-05-10"), tgl("2026-05-11")];

    await prisma.$transaction((tx) => tulisTanggalAcaraTagihan(jejak.tagihan!, dua, tx));
    await prisma.$transaction((tx) => tulisTanggalAcaraTagihan(jejak.tagihan!, dua, tx));

    const sesudah = await prisma.invoice_event_dates.findMany({
      where: { invoice_id: jejak.tagihan! },
      orderBy: { event_date: "asc" },
      select: { event_date: true },
    });

    expect(sesudah).toHaveLength(2);
    expect(ringkasTanggalAcara(sesudah.map((b) => b.event_date))).toBe("Minggu 10 – Senin 11 Mei 2026");

    // Tanggal yang dihapus dari formulir harus benar-benar hilang.
    await prisma.$transaction((tx) => tulisTanggalAcaraTagihan(jejak.tagihan!, [], tx));
    expect(
      await prisma.invoice_event_dates.count({ where: { invoice_id: jejak.tagihan! } }),
    ).toBe(0);
  });

  it("ikut terhapus bersama dokumen induknya", async () => {
    await prisma.$transaction((tx) =>
      tulisTanggalAcaraTagihan(jejak.tagihan!, [tgl("2026-05-10")], tx),
    );

    const id = jejak.tagihan!;
    await prisma.invoices.delete({ where: { id } });
    jejak.tagihan = null;

    expect(await prisma.invoice_event_dates.count({ where: { invoice_id: id } })).toBe(0);
  });
});

describe("dokumen yang dibuat sebelum tanggal menjadi daftar", () => {
  it("acara sehari tetap membawa tanggalnya ke formulir", () => {
    expect(tanggalAcaraUntukFormulir([], tgl("2026-06-30"), 1)).toEqual(["2026-06-30"]);
  });

  it("acara beberapa hari dibaca sebagai tanggal berurutan", () => {
    // Itulah arti kolom "jumlah hari" sebelum ada daftarnya.
    expect(tanggalAcaraUntukFormulir([], tgl("2026-06-30"), 3)).toEqual([
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ]);
  });

  it("daftar yang sudah ada MENANG atas kolom lamanya", () => {
    expect(
      tanggalAcaraUntukFormulir([{ event_date: tgl("2026-05-10") }], tgl("2026-06-30"), 3),
    ).toEqual(["2026-05-10"]);
  });

  it("dokumen tanpa tanggal tetap tanpa tanggal", () => {
    expect(tanggalAcaraUntukFormulir([], null, null)).toEqual([]);
  });
});
