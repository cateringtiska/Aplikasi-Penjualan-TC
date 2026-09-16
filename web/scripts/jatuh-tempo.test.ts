import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma";

/* ==========================================================================
   INVOICE YANG LEWAT TEMPO HARUS TERHITUNG, WALAU STATUSNYA BELUM BERPINDAH

   Kolom `status` adalah SALINAN: ia hanya berpindah ke "overdue" ketika ada
   yang menyentuhnya — sampai sekarang, saat daftar Invoice dibuka. Sumber
   kebenarannya adalah `due_date`.

   Dashboard adalah halaman pertama yang dilihat orang setelah masuk. Kalau ia
   menghitung dari kolom status, invoice yang lewat tempo semalam masih
   terhitung nol sampai ada yang kebetulan membuka daftar Invoice — dan angka
   nol pada kartu "Jatuh tempo" adalah angka yang membuat orang berhenti
   menagih.

   Jadi dua hal dikunci di sini: penghitungan berdasarkan TANGGAL menemukan
   invoice yang statusnya masih basi, dan penyegaran statusnya sendiri bekerja
   serta boleh dijalankan berulang kali.
   ========================================================================== */

const TANDA = "UJI TEMPO";
const jejak = { pelanggan: null as bigint | null };

afterAll(async () => {
  if (jejak.pelanggan) {
    await prisma.invoices.deleteMany({ where: { customer_id: jejak.pelanggan } });
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }
  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);
  await prisma.$disconnect();
});

const BELUM_LUNAS = ["unpaid", "partial", "overdue"];

function awalHariIni() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function hariLalu(n: number) {
  const t = awalHariIni();
  t.setDate(t.getDate() - n);
  return t;
}

describe("invoice jatuh tempo", () => {
  it("terhitung dari tanggal walau kolom statusnya masih 'unpaid'", async () => {
    const cap = Date.now().toString().slice(-6);

    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UJT-${cap}`,
        name: `${TANDA} Pelanggan`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true },
    });
    jejak.pelanggan = pelanggan.id;

    // Sengaja dibuat BASI: tanggalnya sudah lewat, tetapi statusnya masih
    // "unpaid" — persis keadaan sebuah invoice yang lewat tempo semalam dan
    // belum ada yang membuka daftarnya.
    const basi = await prisma.invoices.create({
      data: {
        invoice_number: `UJT-INV-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: hariLalu(30),
        due_date: hariLalu(5),
        subtotal: "1000000",
        grand_total: "1000000",
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true },
    });

    // Cara LAMA: menghitung dari kolom status. Tidak menemukannya.
    const caraLama = await prisma.invoices.count({
      where: { id: basi.id, status: "overdue" },
    });
    expect(caraLama, "kolom status memang belum berpindah").toBe(0);

    // Cara yang dipakai Dashboard sekarang: dari tanggalnya.
    const caraBaru = await prisma.invoices.count({
      where: { id: basi.id, status: { in: BELUM_LUNAS }, due_date: { lt: awalHariIni() } },
    });
    expect(caraBaru, "dihitung dari due_date, jadi ketemu").toBe(1);
  });

  it("menyegarkan statusnya, dan aman dijalankan berulang", async () => {
    const { tandaiJatuhTempo } = await import("../app/(aplikasi)/tagihan/actions");

    await tandaiJatuhTempo();
    const sesudah = await prisma.invoices.findFirst({
      where: { customer_id: jejak.pelanggan! },
      select: { status: true },
    });
    expect(sesudah?.status).toBe("overdue");

    // Dipanggil setiap kali Dashboard dan daftar Invoice dibuka, jadi harus
    // tidak mengubah apa pun pada pemanggilan kedua.
    await tandaiJatuhTempo();
    const lagi = await prisma.invoices.findFirst({
      where: { customer_id: jejak.pelanggan! },
      select: { status: true },
    });
    expect(lagi?.status).toBe("overdue");
  });

  it("tidak menyentuh yang sudah lunas maupun yang dibatalkan", async () => {
    const cap = `${Date.now().toString().slice(-5)}z`;

    for (const status of ["paid", "cancelled"]) {
      await prisma.invoices.create({
        data: {
          invoice_number: `UJT-${status}-${cap}`,
          customer_id: jejak.pelanggan!,
          invoice_date: hariLalu(30),
          due_date: hariLalu(5),
          subtotal: "500000",
          grand_total: "500000",
          paid_amount: status === "paid" ? "500000" : "0",
          status,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    const { tandaiJatuhTempo } = await import("../app/(aplikasi)/tagihan/actions");
    await tandaiJatuhTempo();

    const tetap = await prisma.invoices.findMany({
      where: { customer_id: jejak.pelanggan!, invoice_number: { contains: cap } },
      select: { invoice_number: true, status: true },
      orderBy: { invoice_number: "asc" },
    });

    // Yang lunas tidak punya tunggakan, dan yang dibatalkan tidak pernah
    // menjadi piutang. Keduanya tidak boleh ikut ditandai jatuh tempo.
    expect(tetap.map((t) => t.status).sort()).toEqual(["cancelled", "paid"]);
  });
});
