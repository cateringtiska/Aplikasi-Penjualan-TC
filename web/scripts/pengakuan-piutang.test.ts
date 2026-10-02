import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ambilPiutang } from "../lib/laporan-piutang";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   PIUTANG HANYA DARI ACARA YANG SUDAH TERJADI

   Aturannya sudah dikunci lib/pengakuan.test.ts. Yang dibuktikan DI SINI
   adalah bahwa laporan piutang benar-benar memakainya — dan, yang sama
   pentingnya, bahwa uang yang keluar dari piutang TIDAK HILANG melainkan
   pindah ke keranjang yang disebutkan.

   Kalau angkanya hilang begitu saja, invoice yang baru terbit akan terlihat
   seperti tidak tercatat, dan yang pertama menyadarinya adalah orang yang
   mencarinya untuk ditagih.
   ========================================================================== */

const TANDA = "UJI PENGAKUAN";

const jejak = {
  pelanggan: null as bigint | null,
  sudah: null as bigint | null,
  belumBayar: null as bigint | null,
  belumPanjar: null as bigint | null,
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
      customer_code: `UJP-${cap}`,
      name: `${TANDA} Pelanggan`,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pelanggan = pelanggan.id;

  const bikin = async (
    tanda: string,
    total: string,
    dibayar: string,
    selisihAcara: number,
  ) => {
    const t = await prisma.invoices.create({
      data: {
        invoice_number: `UJP-${tanda}-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: hari(-30),
        due_date: hari(-5),
        subtotal: total,
        grand_total: total,
        paid_amount: dibayar,
        status: Number(dibayar) > 0 ? "partial" : "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
        invoice_event_dates: {
          create: [{ event_date: hari(selisihAcara), created_at: new Date(), updated_at: new Date() }],
        },
      },
    });
    return t.id;
  };

  // Acaranya sudah lewat: piutang sungguhan.
  jejak.sudah = await bikin("SUDAH", "10000000", "4000000", -3);
  // Acara bulan depan, belum dibayar sama sekali: proyeksi.
  jejak.belumBayar = await bikin("PROYEKSI", "20000000", "0", 30);
  // Acara bulan depan, sudah panjar: diterima di muka + sisanya proyeksi.
  jejak.belumPanjar = await bikin("PANJAR", "30000000", "5000000", 30);
});

afterAll(async () => {
  await prisma.invoices.deleteMany({ where: { invoice_number: { startsWith: "UJP-" } } });
  if (jejak.pelanggan) {
    await prisma.customers.delete({ where: { id: jejak.pelanggan } }).catch(() => {});
  }

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

describe("laporan piutang", () => {
  it("hanya menghitung invoice yang acaranya sudah terjadi", async () => {
    const hasil = await ambilPiutang(TANDA, {});

    // 10 juta - 4 juta. Dua invoice lainnya TIDAK ikut, walaupun keduanya
    // sudah lewat jatuh tempo.
    expect(hasil.totalSemua.toString()).toBe("6000000");
    expect(hasil.daftar).toHaveLength(1);
    expect(hasil.daftar[0].jumlahTagihan).toBe(1);
  });

  it("memindahkan yang belum terjadi ke keranjangnya, bukan menghilangkannya", async () => {
    const hasil = await ambilPiutang(TANDA, {});

    expect(hasil.belumTerjadi.jumlahInvoice).toBe(2);
    expect(hasil.belumTerjadi.uangMuka.toString()).toBe("5000000");
    // Nilai PENUH keduanya: 20 juta yang belum dibayar sama sekali, dan
    // 30 juta yang baru dipanjar. Panjarnya tidak dikurangkan — ia ukuran
    // yang berbeda, dan mengurangkannya akan menyembunyikan nilai
    // penjualan yang sebenarnya belum diakui.
    expect(hasil.belumTerjadi.proyeksi.toString()).toBe("50000000");
  });

  it("tidak ada satu rupiah pun yang hilang", async () => {
    const hasil = await ambilPiutang(TANDA, {});

    // Piutang + diterima di muka + proyeksi + yang sudah dibayar untuk acara
    // yang sudah terjadi = seluruh nilai ketiga invoicenya. Uang muka SENGAJA
    // tidak ikut: ia tumpang tindih dengan proyeksi.
    const jumlah = hasil.totalSemua
      .plus(hasil.belumTerjadi.diterimaDiMuka)
      .plus(hasil.belumTerjadi.proyeksi)
      .plus(4_000_000);

    expect(jumlah.toString()).toBe("60000000");
  });

  it("memasukkannya ke piutang begitu acaranya lewat", async () => {
    // Tanggal acaranya dimundurkan ke kemarin, tanpa menyentuh apa pun yang
    // lain. Itu satu-satunya yang membedakan kedua keadaan.
    await prisma.invoice_event_dates.updateMany({
      where: { invoice_id: jejak.belumBayar! },
      data: { event_date: hari(-1) },
    });

    const hasil = await ambilPiutang(TANDA, {});

    expect(hasil.totalSemua.toString()).toBe("26000000"); // 6 juta + 20 juta
    expect(hasil.belumTerjadi.jumlahInvoice).toBe(1);
  });
});

describe("uang muka dibedakan dari pendapatan diterima di muka", () => {
  it("invoice yang LUNAS sebelum acaranya terjadi masuk keranjang tersendiri", async () => {
    // Keduanya sama-sama uang yang belum boleh diakui, tetapi kewajibannya
    // berbeda: yang lunas sudah tidak perlu ditagih lagi, yang baru panjar
    // masih menyisakan tagihan sebelum acaranya berjalan.
    const cap = Date.now().toString().slice(-6);

    await prisma.invoices.create({
      data: {
        invoice_number: `UJP-LUNASMUKA-${cap}`,
        customer_id: jejak.pelanggan!,
        invoice_date: hari(-30),
        due_date: hari(-5),
        subtotal: "7000000",
        grand_total: "7000000",
        paid_amount: "7000000",
        status: "paid",
        created_at: new Date(),
        updated_at: new Date(),
        invoice_event_dates: {
          create: [{ event_date: hari(45), created_at: new Date(), updated_at: new Date() }],
        },
      },
    });

    const hasil = await ambilPiutang(TANDA, {});

    expect(hasil.belumTerjadi.diterimaDiMuka.toString()).toBe("7000000");

    // Tidak ikut ke uang muka maupun proyeksi, dan tidak menambah piutang.
    expect(hasil.belumTerjadi.uangMuka.toString()).toBe("5000000");
    expect(hasil.totalSemua.toString()).toBe("26000000");
  });
});

/* ==========================================================================
   DOKUMEN YANG TANGGALNYA HANYA DI KOLOM LAMA

   Empat belas dari lima belas invoice sungguhan menyimpan tanggal acaranya
   HANYA di kolom `event_date`, bukan di tabel tanggal yang baru. Laporan
   yang membaca tabelnya saja akan membaca seluruhnya sebagai "tanpa tanggal
   acara" — dan karena tanpa tanggal berarti dianggap sudah terjadi,
   semuanya menumpuk di piutang sementara penjualan bulan ini terbaca nol.

   Itu persis yang dilaporkan pemiliknya: dashboard menyebut "0 acara sudah
   terjadi" pada hari yang justru ada acaranya.
   ========================================================================== */

describe("tanggal acara di kolom lama", () => {
  it("tetap dibaca, walaupun tabel tanggalnya kosong", async () => {
    const cap = `${Date.now().toString().slice(-6)}L`;
    // Diukur sebagai SELISIH, bukan angka mutlak: tes di atas sengaja
    // mengubah data, dan angka mutlak akan mengunci urutannya.
    const sebelum = await ambilPiutang(TANDA, {});

    // Tidak ada satu pun baris di invoice_event_dates — persis seperti
    // seluruh invoice yang terbit sebelum tanggal acara menjadi daftar.
    await prisma.invoices.create({
      data: {
        invoice_number: `UJP-KOLOMLAMA-${cap}`,
        customer_id: jejak.pelanggan!,
        invoice_date: hari(-30),
        due_date: hari(-5),
        subtotal: "9000000",
        grand_total: "9000000",
        paid_amount: "0",
        status: "unpaid",
        event_date: hari(60),
        event_days: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const hasil = await ambilPiutang(TANDA, {});

    // Acaranya dua bulan lagi, jadi seluruh nilainya masuk proyeksi dan
    // TIDAK satu rupiah pun masuk piutang.
    expect(hasil.belumTerjadi.proyeksi.minus(sebelum.belumTerjadi.proyeksi).toString()).toBe(
      "9000000",
    );
    expect(hasil.totalSemua.toString()).toBe(sebelum.totalSemua.toString());
  });

  it("membaca jumlah hari sebagai tanggal berurutan", async () => {
    const cap = `${Date.now().toString().slice(-6)}M`;
    const sebelum = await ambilPiutang(TANDA, {});

    // Acara mulai KEMARIN selama tiga hari: hari terakhirnya masih besok,
    // jadi acaranya belum selesai. Membaca tanggalnya saja tanpa jumlah
    // harinya akan menyatakannya sudah selesai sejak kemarin.
    await prisma.invoices.create({
      data: {
        invoice_number: `UJP-TIGAHARI-${cap}`,
        customer_id: jejak.pelanggan!,
        invoice_date: hari(-30),
        due_date: hari(-5),
        subtotal: "3000000",
        grand_total: "3000000",
        paid_amount: "0",
        status: "unpaid",
        event_date: hari(-1),
        event_days: 3,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const hasil = await ambilPiutang(TANDA, {});

    expect(hasil.belumTerjadi.proyeksi.minus(sebelum.belumTerjadi.proyeksi).toString()).toBe(
      "3000000",
    );
    expect(hasil.totalSemua.toString()).toBe(sebelum.totalSemua.toString());
  });
});
