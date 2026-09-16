import { afterAll, describe, expect, it } from "vitest";

import { NILAI_KATEGORI } from "../lib/biaya";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   DAFTAR KATEGORI DI APLIKASI HARUS SAMA DENGAN YANG DI DATABASE

   Kedua tabel biaya punya CHECK constraint yang menyebut kategori satu per
   satu. Menambah kategori di lib/biaya.ts saja tidak cukup: aplikasinya
   menampilkan pilihan baru, pengguna memilihnya, lalu database menolak —
   dan yang sampai ke layar hanya "Baris biaya gagal disimpan."

   Persis itu yang terjadi saat kategori "PB1 disetor" ditambahkan. Bug-nya
   lolos typecheck, lolos lint, lolos seluruh tes, dan baru ketahuan ketika
   pemiliknya mencoba menyimpan.

   Tes ini membaca batasan yang BENAR-BENAR terpasang di database dan
   mencocokkannya dengan daftar di aplikasi. Kalau nanti ada kategori baru
   yang ditambahkan tanpa menjalankan scripts/selaraskan-kategori-biaya.mjs,
   tes ini gagal sebelum sempat sampai ke pengguna.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

/** Kategori yang benar-benar diizinkan database, dibaca dari definisinya. */
async function kategoriDiDatabase(tabel: string): Promise<string[]> {
  const baris = await prisma.$queryRawUnsafe<{ aturan: string }[]>(
    `SELECT pg_get_constraintdef(c.oid) AS aturan
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = $1 AND c.contype = 'c' AND c.conname LIKE '%category%'`,
    tabel,
  );

  expect(baris, `${tabel} harus punya satu batasan kategori`).toHaveLength(1);

  return [...baris[0].aturan.matchAll(/'([a-z0-9_]+)'::/g)]
    .map((m) => m[1])
    .sort();
}

describe("kategori biaya", () => {
  it.each(["invoice_costs", "quotation_costs"])(
    "%s mengizinkan persis kategori yang ditawarkan aplikasi",
    async (tabel) => {
      expect(await kategoriDiDatabase(tabel)).toEqual([...NILAI_KATEGORI].sort());
    },
  );

  it("mengizinkan PB1, kategori yang dulu ditolak database", async () => {
    // Disebut terpisah karena inilah kasus yang pernah lolos ke pengguna.
    for (const tabel of ["invoice_costs", "quotation_costs"]) {
      expect(await kategoriDiDatabase(tabel)).toContain("pb1");
    }
  });

  it("benar-benar menolak kategori karangan", async () => {
    // Membuktikan batasannya hidup, bukan sekadar ada teksnya. Tanpa ini,
    // batasan yang salah tulis pun akan lolos tes di atas.
    const pelanggan = await prisma.customers.findFirst({ select: { id: true } });
    const invoice = await prisma.invoices.findFirst({ select: { id: true } });
    if (!pelanggan || !invoice) return;

    await expect(
      prisma.invoice_costs.create({
        data: {
          invoice_id: invoice.id,
          category: "kategori_karangan",
          description: "Uji batasan",
          estimated_amount: "1000",
          status: "estimasi",
          created_at: new Date(),
          updated_at: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
