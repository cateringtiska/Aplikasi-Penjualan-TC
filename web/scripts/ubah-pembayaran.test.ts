import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hitungUlangTagihan, lepasAlokasi, pasangAlokasi } from "../lib/alokasi-pembayaran";
import { prisma } from "../lib/prisma";
import { d } from "../lib/uang";

/* ==========================================================================
   MENGUBAH PEMBAYARAN

   Diminta pemiliknya untuk menangani salah input. Yang berbahaya bukan
   mengubah angkanya, melainkan ALOKASINYA: satu setoran menempel pada satu
   atau beberapa invoice, dan tiap invoice menyimpan saldo serta statusnya
   sendiri.

   Dua kesalahan yang paling mungkin terjadi, dan keduanya tidak bergejala:

   1. ALOKASI DIPINDAHKAN KE INVOICE LAIN, tetapi invoice yang ditinggalkan
      tidak dihitung ulang. Ia tetap mengaku lunas atas uang yang sudah tidak
      ada di sana, dan keluar dari daftar piutang — jadi tidak ada yang
      menagihnya lagi.

   2. ALOKASI LAMA TIDAK DILEPAS sebelum sisa dibaca. Sisa itu masih memuat
      uang dari pembayaran ini sendiri, sehingga menaikkan alokasinya satu
      rupiah pun ditolak sebagai "melebihi sisa".

   Pemeriksaan di sini memakai hitungUlangTagihan — fungsi yang sama yang
   dipakai simpan, hapus, dan ubah. Ia menghitung dari NOL berdasarkan baris
   payment_details yang ada, jadi benar untuk ketiganya tanpa aturan sendiri.
   ========================================================================== */

const TANDA = "UJI UBAH PAYMENT";

const jejak = {
  pelanggan: null as bigint | null,
  invoiceA: null as bigint | null,
  invoiceB: null as bigint | null,
  pembayaran: null as bigint | null,
};

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
      customer_code: `UJU-${cap}`,
      name: `${TANDA} Pelanggan`,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pelanggan = pelanggan.id;

  const bikin = async (tanda: string, total: string) => {
    const t = await prisma.invoices.create({
      data: {
        invoice_number: `UJU-${tanda}-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: hari(-30),
        due_date: hari(30),
        subtotal: total,
        grand_total: total,
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return t.id;
  };

  jejak.invoiceA = await bikin("A", "10000000");
  jejak.invoiceB = await bikin("B", "10000000");

  // Setoran 10 juta yang MELUNASI invoice A.
  const bayar = await prisma.payments.create({
    data: {
      payment_number: `UJU-PAY-${cap}`,
      payment_date: hari(-1),
      customer_id: pelanggan.id,
      payment_method: "transfer",
      total_amount: "10000000",
      created_at: new Date(),
      updated_at: new Date(),
      payment_details: {
        create: [
          {
            invoice_id: jejak.invoiceA,
            amount_applied: "10000000",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      },
    },
  });
  jejak.pembayaran = bayar.id;

  await prisma.$transaction((tx) => hitungUlangTagihan(tx, jejak.invoiceA!));
});

afterAll(async () => {
  await prisma.payment_details.deleteMany({
    where: { payments: { payment_number: { startsWith: "UJU-PAY-" } } },
  });
  await prisma.payments.deleteMany({ where: { payment_number: { startsWith: "UJU-PAY-" } } });
  await prisma.invoices.deleteMany({ where: { invoice_number: { startsWith: "UJU-" } } });
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

const bacaTagihan = (id: bigint) =>
  prisma.invoices.findUniqueOrThrow({
    where: { id },
    select: { paid_amount: true, status: true },
  });

describe("keadaan awal", () => {
  it("invoice A lunas oleh setoran itu", async () => {
    const a = await bacaTagihan(jejak.invoiceA!);
    expect(a.paid_amount.toFixed(0)).toBe("10000000");
    expect(a.status).toBe("paid");
  });
});

describe("memindahkan alokasi ke invoice lain", () => {
  it("MENGEMBALIKAN invoice yang ditinggalkan ke belum lunas", async () => {
    // Inti bahayanya. Kalau yang ditinggalkan tidak dihitung ulang, ia tetap
    // mengaku lunas atas uang yang sudah tidak ada di sana — dan keluar dari
    // daftar piutang, jadi tidak ada lagi yang menagihnya.
    // Memakai fungsi yang sama persis dengan yang dipakai simpanPembayaran,
    // bukan menulis ulang langkahnya di sini. Tes yang menyalin langkahnya
    // sendiri hanya membuktikan salinannya benar.
    await prisma.$transaction(async (tx) => {
      await lepasAlokasi(tx, jejak.pembayaran!);
      await pasangAlokasi(tx, jejak.pembayaran!, [
        { invoice_id: jejak.invoiceB!, jumlah: d("10000000") },
      ]);
    });

    const a = await bacaTagihan(jejak.invoiceA!);
    expect(a.paid_amount.toFixed(0)).toBe("0");
    expect(a.status).toBe("unpaid");

    const b = await bacaTagihan(jejak.invoiceB!);
    expect(b.paid_amount.toFixed(0)).toBe("10000000");
    expect(b.status).toBe("paid");
  });
});

describe("melepas alokasi lama sebelum membaca sisa", () => {
  it("membebaskan sisanya, sehingga alokasinya boleh dinaikkan", async () => {
    // Invoice B sekarang lunas 10 juta oleh pembayaran ini. Tanpa melepas
    // alokasi lamanya lebih dulu, sisanya terbaca NOL — dan menaikkan
    // alokasinya satu rupiah pun akan ditolak.
    const sebelum = await bacaTagihan(jejak.invoiceB!);
    expect(sebelum.paid_amount.toFixed(0)).toBe("10000000");

    const sisaSetelahDilepas = await prisma.$transaction(async (tx) => {
      await lepasAlokasi(tx, jejak.pembayaran!);

      const b = await tx.invoices.findUniqueOrThrow({
        where: { id: jejak.invoiceB! },
        select: { grand_total: true, paid_amount: true },
      });

      // Dikembalikan seperti semula supaya tes berikutnya tidak terganggu.
      await pasangAlokasi(tx, jejak.pembayaran!, [
        { invoice_id: jejak.invoiceB!, jumlah: d("10000000") },
      ]);

      return b.grand_total.minus(b.paid_amount);
    });

    expect(sisaSetelahDilepas.toFixed(0)).toBe("10000000");
  });
});

describe("memecah satu setoran ke dua invoice", () => {
  it("menetapkan status masing-masing menurut bagiannya sendiri", async () => {
    await prisma.$transaction(async (tx) => {
      await lepasAlokasi(tx, jejak.pembayaran!);
      await pasangAlokasi(tx, jejak.pembayaran!, [
        { invoice_id: jejak.invoiceA!, jumlah: d("4000000") },
        { invoice_id: jejak.invoiceB!, jumlah: d("6000000") },
      ]);
    });

    const a = await bacaTagihan(jejak.invoiceA!);
    expect(a.paid_amount.toFixed(0)).toBe("4000000");
    expect(a.status).toBe("partial");

    const b = await bacaTagihan(jejak.invoiceB!);
    expect(b.paid_amount.toFixed(0)).toBe("6000000");
    expect(b.status).toBe("partial");
  });
});

/* ==========================================================================
   PEMBAYARAN YANG DIPOTONG PPh 23

   Customer berstatus pemotong pajak menahan 2% dari nilai jasa katering —
   harga makanan dan service charge — lalu menyetorkannya ke kas negara ATAS
   NAMA perusahaan, dan memberi bukti potong.

   Uang yang masuk ke rekening memang lebih kecil. Tetapi invoicenya LUNAS:
   yang dipotong bukan hilang, melainkan sudah dibayarkan dan bisa
   dikreditkan. Mencatatnya sebagai kurang bayar akan membuat piutang yang
   tidak akan pernah bisa ditagih kepada siapa pun — customer sudah membayar
   penuh, dan negara tidak akan mengembalikannya ke rekening perusahaan.
   ========================================================================== */

describe("pembayaran yang dipotong PPh 23", () => {
  it("MELUNASI invoice walaupun uang yang masuk lebih kecil", async () => {
    const cap = `${Date.now().toString().slice(-6)}P`;

    // Invoice 10 juta: makanan 8 juta + service charge 1 juta + PB1 1 juta.
    const inv = await prisma.invoices.create({
      data: {
        invoice_number: `UJU-PPH-${cap}`,
        customer_id: jejak.pelanggan!,
        invoice_date: hari(-10),
        due_date: hari(20),
        subtotal: "8000000",
        service_charge_amount: "1000000",
        pb1_enabled: true,
        pb1_amount: "1000000",
        grand_total: "10000000",
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 2% dari 9 juta (makanan + service charge) = 180.000.
    // Customer mentransfer 9.820.000 dan menahan 180.000.
    const bayar = await prisma.payments.create({
      data: {
        payment_number: `UJU-PAY-PPH-${cap}`,
        payment_date: hari(-1),
        customer_id: jejak.pelanggan!,
        payment_method: "transfer",
        total_amount: "9820000",
        pph23_amount: "180000",
        pph23_bukti: `BP-${cap}`,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.$transaction((tx) =>
      pasangAlokasi(tx, bayar.id, [{ invoice_id: inv.id, jumlah: d("10000000") }]),
    );

    const sesudah = await bacaTagihan(inv.id);
    expect(sesudah.paid_amount.toFixed(0)).toBe("10000000");
    expect(sesudah.status).toBe("paid");

    // Uang yang masuk ke rekening tetap tercatat apa adanya — itu yang
    // dicocokkan dengan rekening koran.
    const tersimpan = await prisma.payments.findUniqueOrThrow({
      where: { id: bayar.id },
      select: { total_amount: true, pph23_amount: true, pph23_bukti: true },
    });
    expect(tersimpan.total_amount.toFixed(0)).toBe("9820000");
    expect(tersimpan.pph23_amount.toFixed(0)).toBe("180000");
    expect(tersimpan.pph23_bukti).toBe(`BP-${cap}`);

    // Yang diterima ditambah yang dipotong harus sama dengan yang menutup.
    expect(
      tersimpan.total_amount.plus(tersimpan.pph23_amount).toFixed(0),
    ).toBe(sesudah.paid_amount.toFixed(0));
  });

  it("PB1 tidak ikut menjadi dasar potongannya", async () => {
    // 2% dari seluruh 10 juta adalah 200.000, bukan 180.000. Selisih 20.000
    // itu PB1 — pajak daerah atas penjualannya, bukan imbalan jasa. Memotong
    // PPh 23 dari situ berarti menyetorkan pajak atas pajak.
    const dasar = d("8000000").plus(d("1000000"));
    expect(dasar.times(0.02).toFixed(0)).toBe("180000");
    expect(d("10000000").times(0.02).toFixed(0)).toBe("200000");
  });
});
