import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ambilKartuPiutang } from "../lib/kartu-piutang";
import { ambilLaporan } from "../lib/laporan-penjualan";
import { ambilPiutang } from "../lib/laporan-piutang";
import { prisma } from "../lib/prisma";
import { hanyaMiliknya } from "../lib/rbac";
import { d } from "../lib/uang";

/* ==========================================================================
   SALES HANYA MELIHAT YANG IA KERJAKAN SENDIRI

   Peran Sales dulu melihat ANGKA SELURUH PERUSAHAAN: total piutang, total
   penjualan bulan ini, seluruh daftar quotation dan invoice, laporan
   penjualan, dan kartu piutang. Seorang sales yang baru masuk kerja langsung
   mengetahui omzet dan piutang perusahaan.

   Kebocoran semacam ini TIDAK PUNYA GEJALA. Semua halaman tetap tampil
   rapi, semua angka tetap benar menurut rumusnya; yang salah hanya SIAPA
   yang boleh melihatnya. Tidak ada yang akan menemukannya dari memakai
   aplikasinya, jadi penjagaannya harus berupa tes.

   Dibuat dua sales dengan dokumennya masing-masing, lalu diperiksa bahwa
   yang satu tidak pernah melihat sepeser pun milik yang lain — termasuk di
   dalam PENJUMLAHAN, bukan hanya di daftar barisnya. Penjumlahan adalah
   tempat kebocoran paling mudah lolos: satu angka total tidak menunjukkan
   baris mana saja yang ikut dihitung.
   ========================================================================== */

const TANDA = "UJI HAK AKSES SALES";

const jejak = {
  pelanggan: null as bigint | null,
  salesA: null as bigint | null,
  salesB: null as bigint | null,
  tagihanA: null as bigint | null,
  tagihanB: null as bigint | null,
  penawaranA: null as bigint | null,
  penawaranB: null as bigint | null,
};

/** Sesi tiruan — hanya peran dan id yang dipakai oleh hanyaMiliknya(). */
const sesi = (id: bigint, peran: "sales" | "finance" | "admin") =>
  ({ id: id.toString(), peran }) as Parameters<typeof hanyaMiliknya>[0];

beforeAll(async () => {
  const cap = Date.now().toString().slice(-6);

  const pelanggan = await prisma.customers.create({
    data: {
      customer_code: `UJS-${cap}`,
      name: `${TANDA} Pelanggan`,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pelanggan = pelanggan.id;

  for (const [huruf, kunciSales] of [
    ["A", "salesA"],
    ["B", "salesB"],
  ] as const) {
    const u = await prisma.users.create({
      data: {
        name: `${TANDA} ${huruf}`,
        username: `ujisales${huruf.toLowerCase()}${cap}`,
        email: `ujisales${huruf.toLowerCase()}${cap}@contoh.invalid`,
        password: "x".repeat(60),
        role: "sales",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    jejak[kunciSales] = u.id;
  }

  // Nilainya sengaja dibedakan jauh, supaya angka yang tercampur langsung
  // kelihatan dari totalnya saja.
  const bikin = async (huruf: "A" | "B", pembuat: bigint, nilai: string) => {
    const t = await prisma.invoices.create({
      data: {
        invoice_number: `UJS-INV-${huruf}-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86_400_000),
        subtotal: nilai,
        grand_total: nilai,
        paid_amount: "0",
        status: "unpaid",
        created_by: pembuat,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const p = await prisma.quotations.create({
      data: {
        quotation_number: `UJS-QUO-${huruf}-${cap}`,
        customer_id: pelanggan.id,
        quotation_date: new Date(),
        valid_until: new Date(Date.now() + 30 * 86_400_000),
        subtotal: nilai,
        grand_total: nilai,
        status: "draft",
        created_by: pembuat,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return [t.id, p.id] as const;
  };

  [jejak.tagihanA, jejak.penawaranA] = await bikin("A", jejak.salesA!, "1000000");
  [jejak.tagihanB, jejak.penawaranB] = await bikin("B", jejak.salesB!, "7000000");
});

afterAll(async () => {
  await prisma.invoices.deleteMany({ where: { invoice_number: { startsWith: "UJS-INV-" } } });
  await prisma.quotations.deleteMany({ where: { quotation_number: { startsWith: "UJS-QUO-" } } });
  await prisma.users.deleteMany({ where: { name: { startsWith: TANDA } } });
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

describe("penyaring hanyaMiliknya", () => {
  it("menyaring sales, dan TIDAK menyaring finance maupun admin", () => {
    expect(hanyaMiliknya(sesi(BigInt(7), "sales"))).toEqual({ created_by: BigInt(7) });

    // Mengurus uang perusahaan memang pekerjaan mereka.
    expect(hanyaMiliknya(sesi(BigInt(7), "finance"))).toEqual({});
    expect(hanyaMiliknya(sesi(BigInt(7), "admin"))).toEqual({});
  });
});

describe("laporan penjualan", () => {
  const saring = { dari: "", sampai: "", pelanggan: "" };

  it("hanya memuat dokumen sales yang bersangkutan", async () => {
    const a = await ambilLaporan(saring, hanyaMiliknya(sesi(jejak.salesA!, "sales")));
    const nomor = a.baris.map((b) => b.nomor);

    expect(nomor.some((n) => n.includes("UJS-INV-A-"))).toBe(true);
    expect(
      nomor.some((n) => n.includes("UJS-INV-B-")),
      "invoice sales lain ikut terbawa",
    ).toBe(false);
  });

  it("tidak mencampurkan dokumen sales lain ke dalam RINGKASANNYA", async () => {
    // Bagian yang paling mudah lolos: barisnya sudah benar, tetapi totalnya
    // terlanjur dihitung dari semua dokumen.
    const a = await ambilLaporan(saring, hanyaMiliknya(sesi(jejak.salesA!, "sales")));
    const b = await ambilLaporan(saring, hanyaMiliknya(sesi(jejak.salesB!, "sales")));

    const hanyaUji = (r: Awaited<ReturnType<typeof ambilLaporan>>) =>
      r.baris
        .filter((x) => x.nomor.startsWith("UJS-INV-"))
        .reduce((j, x) => j.plus(d(x.total)), d(0));

    expect(hanyaUji(a).toString()).toBe("1000000");
    expect(hanyaUji(b).toString()).toBe("7000000");
  });

  it("memperlihatkan keduanya kepada finance", async () => {
    const semua = await ambilLaporan(saring, hanyaMiliknya(sesi(jejak.salesA!, "finance")));
    const nomor = semua.baris.map((b) => b.nomor);

    expect(nomor.some((n) => n.includes("UJS-INV-A-"))).toBe(true);
    expect(nomor.some((n) => n.includes("UJS-INV-B-"))).toBe(true);
  });
});

describe("kartu piutang", () => {
  it("hanya menghitung invoice sales yang bersangkutan", async () => {
    const a = await ambilKartuPiutang(
      jejak.pelanggan!.toString(),
      hanyaMiliknya(sesi(jejak.salesA!, "sales")),
    );

    expect(a).not.toBeNull();

    const nomor = a!.baris.map((b) => b.nomor);
    expect(nomor).toHaveLength(1);
    expect(nomor[0]).toContain("UJS-INV-A-");
    expect(nomor.some((n) => n.includes("UJS-INV-B-"))).toBe(false);
    expect(a!.totalInvoice.toString()).toBe("1000000");
  });

  it("menjumlahkan keduanya untuk finance", async () => {
    const semua = await ambilKartuPiutang(
      jejak.pelanggan!.toString(),
      hanyaMiliknya(sesi(jejak.salesA!, "finance")),
    );

    expect(semua!.totalInvoice.toString()).toBe("8000000");
  });
});

describe("daftar piutang", () => {
  it("tidak membocorkan sisa tagihan sales lain", async () => {
    const a = await ambilPiutang(TANDA, hanyaMiliknya(sesi(jejak.salesA!, "sales")));
    const semua = await ambilPiutang(TANDA, hanyaMiliknya(sesi(jejak.salesA!, "finance")));

    expect(a.totalSemua.toString()).toBe("1000000");
    expect(semua.totalSemua.toString()).toBe("8000000");
  });
});
