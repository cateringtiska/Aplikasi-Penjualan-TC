import { afterAll, describe, expect, it } from "vitest";

import { isiDokumenTagihan } from "../lib/isi-dokumen";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   REFERENSI PO

   Customer korporat membayar berdasarkan nomor PO mereka sendiri. Invoice
   tanpa nomor itu TERTAHAN di bagian hutang mereka: tidak ditolak, tidak
   dikabarkan, hanya tidak kunjung dibayar. Yang menagih baru mengetahuinya
   berminggu-minggu kemudian, dan sampai saat itu angkanya terbaca sebagai
   piutang yang menua tanpa sebab.

   Kolomnya HANYA ADA DI TABEL INVOICES. Quotation adalah penawaran yang
   justru mendahului PO customer.
   ========================================================================== */

const TANDA = "UJI REFERENSI PO";

afterAll(async () => {
  await prisma.invoices.deleteMany({ where: { invoice_number: { startsWith: "UPO-INV-" } } });
  await prisma.customers.deleteMany({ where: { name: { startsWith: TANDA } } });

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

async function buatInvoice(po: string | null) {
  const cap = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

  const pelanggan = await prisma.customers.create({
    data: {
      customer_code: `UPO-${cap}`.slice(0, 50),
      name: `${TANDA} ${cap}`,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  return prisma.invoices.create({
    data: {
      invoice_number: `UPO-INV-${cap}`,
      customer_id: pelanggan.id,
      po_reference: po,
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
}

describe("menyimpan nomor PO", () => {
  it("tersimpan apa adanya, tanpa dirapikan sendiri", async () => {
    // Nomor PO milik customer. Mengubah huruf besar kecilnya atau membuang
    // tanda hubungnya membuat nomor yang tercetak tidak sama dengan yang
    // mereka cari di sistem mereka.
    const aneh = "po/2026/IV-0087 (rev.2)";
    const t = await buatInvoice(aneh);

    const dibaca = await prisma.invoices.findUniqueOrThrow({
      where: { id: t.id },
      select: { po_reference: true },
    });

    expect(dibaca.po_reference).toBe(aneh);
  });

  it("kosong tersimpan sebagai NULL, bukan teks kosong", async () => {
    /*
     * Keduanya terbaca sama di layar, tetapi hanya NULL yang bisa
     * dibedakan saat mencari invoice yang BELUM punya nomor PO — dan itu
     * pertanyaan yang akan ditanyakan ketika pembayaran tidak datang.
     */
    const t = await buatInvoice(null);

    const dibaca = await prisma.invoices.findUniqueOrThrow({
      where: { id: t.id },
      select: { po_reference: true },
    });

    expect(dibaca.po_reference).toBeNull();
  });
});

describe("referensi PO pada dokumen", () => {
  it("ikut terbawa ke isi dokumen cetaknya", async () => {
    const t = await buatInvoice("4500123456");

    const isi = await isiDokumenTagihan(t.id.toString(), {});
    expect(isi?.referensiPo).toBe("4500123456");
  });

  it("null ketika memang tidak ada, bukan teks kosong", async () => {
    // Komponen cetaknya memutuskan menggambar barisnya dari nilai ini.
    // Teks kosong tetap "ada" bagi sebagian pemeriksaan, dan barisnya bisa
    // tergambar sebagai "Referensi PO:" tanpa isi.
    const t = await buatInvoice(null);

    const isi = await isiDokumenTagihan(t.id.toString(), {});
    expect(isi?.referensiPo).toBeNull();
  });
});

describe("quotation tidak punya kolomnya", () => {
  it("memang tidak ada di tabelnya", async () => {
    /*
     * Dijaga supaya kolomnya tidak diam-diam ditambahkan ke quotation
     * "sekalian". Formulir quotation tidak menampilkannya, dan kolom yang
     * ada di tabel tetapi tidak pernah diisi hanya menyesatkan orang
     * berikutnya yang membaca skemanya.
     */
    const kolom = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'quotations' AND column_name = 'po_reference'
    `;

    expect(kolom).toHaveLength(0);
  });

  it("ada di tabel invoices", async () => {
    const kolom = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'invoices' AND column_name = 'po_reference'
    `;

    expect(kolom).toHaveLength(1);
  });
});

describe("kolom bersama harus diterima KEDUA tabel", () => {
  /*
   * siapkanDokumen() menghasilkan satu kumpulan kolom yang disebar apa
   * adanya ke tabel quotations MAUPUN invoices. Menambahkan satu kolom
   * yang hanya ada di salah satunya akan menggagalkan penyimpanan di tabel
   * yang lain — dan kegagalannya muncul sebagai galat Prisma mentah di
   * layar orang yang sedang menyimpan quotation, bukan saat dikompilasi.
   *
   * Itu nyaris terjadi saat kolom po_reference ditambahkan: tidak ada satu
   * pun tes yang menyimpan quotation lewat kolom bersama itu, jadi
   * menaruhnya di tempat yang salah tidak menggagalkan apa pun.
   */
  const muatan = {
    customer_id: "1",
    tanggal: "2026-10-14",
    tanggal_akhir: "2026-10-31",
    event_dates: ["2026-10-14"],
    items: [
      {
        item_name: "Uji kolom bersama",
        unit: "pax",
        day: "1",
        qty: "1",
        pax: "1",
        price: "1000",
        is_compliment: false,
        charge_service: true,
        charge_pb1: true,
        children: [],
      },
    ],
    biaya_tambahan: [],
    service_charge_percent: "0",
    pb1_enabled: false,
    pb1_percent: "0",
    delivery_amount: "0",
    show_payment_terms: false,
    payment_terms: "",
    po_reference: "4500123456",
  };

  it("tabel quotations menerima seluruh kolom bersamanya", async () => {
    const { siapkanDokumen } = await import("../lib/dokumen");
    const siap = siapkanDokumen(muatan, { labelTanggalAkhir: "Berlaku sampai" });
    expect(siap.ok).toBe(true);
    if (!siap.ok) return;

    const pelanggan = await prisma.customers.findFirstOrThrow({ select: { id: true } });

    // Dicoba sungguhan lalu dibatalkan: memeriksa daftar kolomnya sebagai
    // teks hanya membandingkan tulisan, bukan apa yang diterima database.
    let galat: unknown = null;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.quotations.create({
          data: {
            ...siap.kolom,
            customer_id: pelanggan.id,
            quotation_number: `UPO-QUO-${Date.now()}`,
            quotation_date: new Date(),
            valid_until: new Date(),
            status: "draft",
            created_at: new Date(),
          },
          select: { id: true },
        });
        throw new Error("BATALKAN");
      });
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "BATALKAN") galat = e;
    }

    expect(
      galat,
      "kolom bersamanya memuat sesuatu yang tidak ada di tabel quotations",
    ).toBeNull();
  });

  it("tabel invoices juga menerimanya", async () => {
    const { siapkanDokumen } = await import("../lib/dokumen");
    const siap = siapkanDokumen(muatan, { labelTanggalAkhir: "Jatuh tempo" });
    if (!siap.ok) return;

    const pelanggan = await prisma.customers.findFirstOrThrow({ select: { id: true } });

    let galat: unknown = null;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.invoices.create({
          data: {
            ...siap.kolom,
            customer_id: pelanggan.id,
            invoice_number: `UPO-INV-X-${Date.now()}`,
            invoice_date: new Date(),
            due_date: new Date(),
            status: "unpaid",
            paid_amount: "0",
            created_at: new Date(),
          },
          select: { id: true },
        });
        throw new Error("BATALKAN");
      });
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "BATALKAN") galat = e;
    }

    expect(galat, "kolom bersamanya ditolak tabel invoices").toBeNull();
  });
});
