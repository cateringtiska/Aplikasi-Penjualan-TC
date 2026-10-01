import { describe, expect, it } from "vitest";

import {
  angka,
  bulatkanRupiah,
  dasarServiceCharge,
  hitungMargin,
  hitungStatusInvoice,
  hitungSubtotal,
  hitungTotalDokumen,
  labelStatusInvoice,
  nilaiBiaya,
  romawi,
  rupiah,
  sisaTagihan,
  subtotalBaris,
  uraikanRupiah,
  type BarisItem,
} from "./uang";

/* ==========================================================================
   Tes ini adalah jaring pengaman utama penulisan ulang ke Next.js.

   Angka-angka di bawah dihitung dari rumus Laravel yang sedang berjalan.
   Kalau ada satu saja yang berubah, berarti versi Next.js menghitung uang
   berbeda dari versi yang dipakai sehari-hari — dan itu harus ketahuan di
   sini, bukan saat tutup buku.
   ========================================================================== */

/**
 * Satu penawaran katering pernikahan yang khas.
 *
 * Perhatikan baris tenda: ditandai TIDAK kena service charge, karena itu
 * sewa dari pihak ketiga. Inilah sebabnya dasar service charge tidak sama
 * dengan subtotal — kesalahan paling mudah terjadi justru di sini.
 */
const acaraPernikahan: BarisItem[] = [
  { qty: 300, price: 85_000, charge_service: true },   // Buffet prasmanan
  { qty: 2, price: 2_500_000, charge_service: true },  // Pondokan sate ayam
  { qty: 1, price: 7_500_000, charge_service: false }, // Sewa tenda & kursi
  { qty: 300, price: 15_000, charge_service: true, is_compliment: true }, // Welcome drink
];

describe("Baris item", () => {
  it("menghitung qty dikali harga", () => {
    expect(subtotalBaris({ qty: 300, price: 85_000 }).toString()).toBe("25500000");
  });

  it("menghitung item compliment sebagai nol walau qty dan harganya terisi", () => {
    expect(subtotalBaris({ qty: 300, price: 15_000, is_compliment: true }).toString()).toBe("0");
  });

  it("menjumlahkan seluruh baris menjadi subtotal", () => {
    // 25.500.000 + 5.000.000 + 7.500.000 + 0 (compliment)
    expect(hitungSubtotal(acaraPernikahan).toString()).toBe("38000000");
  });
});

describe("Dasar service charge", () => {
  it("mengecualikan baris yang tidak kena service charge dan baris compliment", () => {
    // Hanya buffet + pondokan. Tenda dan welcome drink tidak ikut.
    expect(dasarServiceCharge(acaraPernikahan).toString()).toBe("30500000");
  });

  it("berbeda dari subtotal — ini bukan salah ketik", () => {
    expect(dasarServiceCharge(acaraPernikahan).toString()).not.toBe(
      hitungSubtotal(acaraPernikahan).toString(),
    );
  });

  it("menganggap baris ikut kena service charge bila penandanya tidak diisi", () => {
    expect(dasarServiceCharge([{ qty: 2, price: 1_000 }]).toString()).toBe("2000");
  });
});

describe("Total dokumen", () => {
  it("menghitung satu quotation pernikahan lengkap", () => {
    const hasil = hitungTotalDokumen({
      items: acaraPernikahan,
      service_charge_percent: 5,
      pb1_enabled: true,
      pb1_percent: 10,
    });

    expect(hasil.subtotal.toString()).toBe("38000000");
    expect(hasil.dasar_service_charge.toString()).toBe("30500000");
    expect(hasil.service_charge_amount.toString()).toBe("1525000"); // 5% dari 30,5jt
    expect(hasil.pb1_amount.toString()).toBe("3800000");            // 10% dari subtotal
    expect(hasil.grand_total.toString()).toBe("43325000");
  });

  it("menghitung PB1 dari subtotal, bukan dari subtotal ditambah service charge", () => {
    const hasil = hitungTotalDokumen({
      items: [{ qty: 1, price: 1_000_000 }],
      service_charge_percent: 10,
      pb1_enabled: true,
      pb1_percent: 10,
    });

    // Kalau PB1 keliru dihitung dari 1.100.000, hasilnya jadi 110.000.
    expect(hasil.pb1_amount.toString()).toBe("100000");
    expect(hasil.grand_total.toString()).toBe("1200000");
  });

  it("tidak mengenakan service charge bila persennya kosong atau nol", () => {
    const kosong = hitungTotalDokumen({ items: acaraPernikahan });
    const nol = hitungTotalDokumen({ items: acaraPernikahan, service_charge_percent: 0 });

    expect(kosong.service_charge_amount.toString()).toBe("0");
    expect(nol.service_charge_amount.toString()).toBe("0");
  });

  it("tidak mengenakan PB1 bila tidak dinyalakan, walau persennya terisi", () => {
    const hasil = hitungTotalDokumen({
      items: [{ qty: 1, price: 1_000_000 }],
      pb1_enabled: false,
      pb1_percent: 10,
    });
    expect(hasil.pb1_amount.toString()).toBe("0");
  });

  it("menghitung PB1 hanya dari baris yang ditandai", () => {
    // Dua baris senilai sama; hanya satu yang objek PB1.
    const hasil = hitungTotalDokumen({
      items: [
        { qty: 1, price: 1_000_000, charge_pb1: true },
        { qty: 1, price: 1_000_000, charge_pb1: false },
      ],
      pb1_enabled: true,
      pb1_percent: 10,
    });

    expect(hasil.subtotal.toString()).toBe("2000000");
    expect(hasil.dasar_pb1.toString()).toBe("1000000");
    // 10% dari 1 juta, BUKAN dari subtotal 2 juta.
    expect(hasil.pb1_amount.toString()).toBe("100000");
    expect(hasil.grand_total.toString()).toBe("2100000");
  });

  it("menganggap baris tanpa penanda tetap kena PB1", () => {
    // Inilah yang membuat dokumen lama menghasilkan angka yang sama persis:
    // sebelum penanda ini ada, SELURUH subtotal memang dikenai PB1.
    const hasil = hitungTotalDokumen({
      items: [{ qty: 1, price: 1_000_000 }, { qty: 1, price: 1_000_000 }],
      pb1_enabled: true,
      pb1_percent: 10,
    });

    expect(hasil.dasar_pb1.toString()).toBe("2000000");
    expect(hasil.pb1_amount.toString()).toBe("200000");
  });

  it("memisahkan dasar PB1 dari dasar service charge", () => {
    // Keduanya ditandai per baris, dan tidak harus baris yang sama. Sebuah
    // baris bisa kena service charge tetapi bebas PB1, atau sebaliknya.
    const hasil = hitungTotalDokumen({
      items: [
        { qty: 1, price: 1_000_000, charge_service: true, charge_pb1: false },
        { qty: 1, price: 4_000_000, charge_service: false, charge_pb1: true },
      ],
      service_charge_percent: 10,
      pb1_enabled: true,
      pb1_percent: 10,
    });

    expect(hasil.dasar_service_charge.toString()).toBe("1000000");
    expect(hasil.service_charge_amount.toString()).toBe("100000");
    expect(hasil.dasar_pb1.toString()).toBe("4000000");
    expect(hasil.pb1_amount.toString()).toBe("400000");
  });

  it("tidak memajaki baris compliment, walau ditandai kena PB1", () => {
    const hasil = hitungTotalDokumen({
      items: [
        { qty: 1, price: 1_000_000, charge_pb1: true },
        { qty: 300, price: 15_000, charge_pb1: true, is_compliment: true },
      ],
      pb1_enabled: true,
      pb1_percent: 10,
    });

    // Baris compliment bernilai nol bagi pelanggan; memajakinya berarti
    // menagih pajak atas sesuatu yang tidak ditagihkan.
    expect(hasil.dasar_pb1.toString()).toBe("1000000");
    expect(hasil.pb1_amount.toString()).toBe("100000");
  });

  it("menambahkan delivery ke total TANPA memajakinya", () => {
    // Inti aturannya. Delivery adalah ongkos kirim, bukan nilai makanan —
    // jadi ia tidak pernah masuk dasar service charge maupun dasar PB1.
    // Memasukkannya sebagai baris item biasa tidak bisa: PB1 dihitung dari
    // subtotal, sehingga ongkos kirim akan ikut terpajaki.
    const tanpa = hitungTotalDokumen({
      items: [{ qty: 1, price: 1_000_000 }],
      service_charge_percent: 10,
      pb1_enabled: true,
      pb1_percent: 10,
    });

    const dengan = hitungTotalDokumen({
      items: [{ qty: 1, price: 1_000_000 }],
      service_charge_percent: 10,
      pb1_enabled: true,
      pb1_percent: 10,
      delivery_amount: 250_000,
    });

    // Kedua pungutan harus sama persis dengan dan tanpa delivery.
    expect(dengan.dasar_service_charge.toString()).toBe(tanpa.dasar_service_charge.toString());
    expect(dengan.service_charge_amount.toString()).toBe(tanpa.service_charge_amount.toString());
    expect(dengan.pb1_amount.toString()).toBe(tanpa.pb1_amount.toString());
    expect(dengan.subtotal.toString()).toBe(tanpa.subtotal.toString());

    // Yang berubah hanya totalnya, persis sebesar delivery-nya.
    expect(dengan.delivery_amount.toString()).toBe("250000");
    expect(dengan.grand_total.minus(tanpa.grand_total).toString()).toBe("250000");

    // 1.000.000 + 100.000 service charge + 100.000 PB1 + 250.000 delivery
    expect(dengan.grand_total.toString()).toBe("1450000");
  });

  it("memperlakukan delivery kosong sebagai nol", () => {
    const hasil = hitungTotalDokumen({ items: [{ qty: 1, price: 500_000 }] });
    expect(hasil.delivery_amount.toString()).toBe("0");
    expect(hasil.grand_total.toString()).toBe("500000");
  });

  it("membulatkan setengah rupiah MENJAUHI nol, meniru round() PHP", () => {
    // Dasar 10, service charge 5% = tepat 0,5 -> harus jadi 1, bukan 0.
    const hasil = hitungTotalDokumen({
      items: [{ qty: 1, price: 10 }],
      service_charge_percent: 5,
    });
    expect(hasil.service_charge_amount.toString()).toBe("1");
  });

  it("tidak kehilangan rupiah pada penjumlahan banyak baris pecahan", () => {
    // Angka pecahan JavaScript biasa akan meleset di sini.
    const items: BarisItem[] = Array.from({ length: 300 }, () => ({ qty: 1, price: "0.1" }));
    expect(hitungSubtotal(items).toString()).toBe("30");
  });
});

describe("Status invoice", () => {
  const kemarin = new Date("2026-09-01");
  const besok = new Date("2026-12-31");
  const sekarang = new Date("2026-09-10");

  it("menjadi lunas ketika pembayaran menutup seluruh invoice", () => {
    expect(
      hitungStatusInvoice({
        statusSekarang: "unpaid",
        grandTotal: 43_325_000,
        totalDibayar: 43_325_000,
        dueDate: besok,
        sekarang,
      }),
    ).toBe("paid");
  });

  it("tetap lunas walau tanggal jatuh temponya sudah lewat", () => {
    expect(
      hitungStatusInvoice({
        statusSekarang: "overdue",
        grandTotal: 10_000_000,
        totalDibayar: 10_000_000,
        dueDate: kemarin,
        sekarang,
      }),
    ).toBe("paid");
  });

  it("mengutamakan jatuh tempo di atas dibayar-sebagian", () => {
    // Ini perilaku Laravel yang dipertahankan: invoice lewat tempo yang sudah
    // dibayar sebagian tetap berstatus "overdue", bukan "partial".
    expect(
      hitungStatusInvoice({
        statusSekarang: "partial",
        grandTotal: 10_000_000,
        totalDibayar: 4_000_000,
        dueDate: kemarin,
        sekarang,
      }),
    ).toBe("overdue");
  });

  it("menjadi dibayar-sebagian bila belum lewat tempo", () => {
    expect(
      hitungStatusInvoice({
        statusSekarang: "unpaid",
        grandTotal: 10_000_000,
        totalDibayar: 4_000_000,
        dueDate: besok,
        sekarang,
      }),
    ).toBe("partial");
  });

  it("tidak pernah mengubah invoice yang sudah dibatalkan", () => {
    expect(
      hitungStatusInvoice({
        statusSekarang: "cancelled",
        grandTotal: 10_000_000,
        totalDibayar: 10_000_000,
        dueDate: kemarin,
        sekarang,
      }),
    ).toBe("cancelled");
  });

  it("tidak menyebut invoice bernilai nol sebagai lunas", () => {
    expect(
      hitungStatusInvoice({
        statusSekarang: "unpaid",
        grandTotal: 0,
        totalDibayar: 0,
        dueDate: besok,
        sekarang,
      }),
    ).toBe("unpaid");
  });

  it("menghitung sisa invoice", () => {
    expect(sisaTagihan(43_325_000, 20_000_000).toString()).toBe("23325000");
  });

  it("memberi label khusus untuk jatuh tempo yang sudah dibayar sebagian", () => {
    expect(labelStatusInvoice("overdue", 4_000_000)).toBe("Jatuh Tempo — Sebagian Terbayar");
    expect(labelStatusInvoice("overdue", 0)).toBe("Jatuh Tempo");
    expect(labelStatusInvoice("paid", 10)).toBe("Lunas");
  });
});

describe("Biaya dan margin", () => {
  it("memakai biaya aktual ketika sudah terisi", () => {
    expect(nilaiBiaya({ estimated_amount: 5_000_000, actual_amount: 5_400_000 }).toString())
      .toBe("5400000");
  });

  it("kembali ke estimasi ketika aktualnya nol atau kosong", () => {
    expect(nilaiBiaya({ estimated_amount: 5_000_000, actual_amount: 0 }).toString())
      .toBe("5000000");
    expect(nilaiBiaya({ estimated_amount: 5_000_000 }).toString()).toBe("5000000");
  });

  it("mengakui SELURUH nilai yang ditagihkan, termasuk service charge dan PB1", () => {
    // Acara yang sama dipakai di seluruh berkas ini: subtotal 38jt, service
    // charge 1.425.000, PB1 3.900.000, grand total 43.325.000.
    //
    // Yang diakui adalah 43.325.000 — seluruh uang yang diminta dari
    // customer. Subtotal saja memaksa satu asumsi, bahwa PB1 selalu
    // disetorkan, dan asumsi yang terkubur di dalam rumus tidak bisa
    // dikoreksi oleh siapa pun yang membaca laporannya.
    const hasil = hitungMargin({
      penjualan: 43_325_000,
      biaya: [
        { estimated_amount: 18_000_000, actual_amount: 19_250_000 }, // HPP bahan baku
        { estimated_amount: 4_500_000 },                             // Tenaga kerja
        { estimated_amount: 7_500_000, actual_amount: 7_500_000 },   // Sewa tenda
      ],
    });

    expect(hasil.net_sales.toString()).toBe("43325000");
    expect(hasil.total_cost.toString()).toBe("31250000");
    expect(hasil.profit.toString()).toBe("12075000");
    expect(hasil.margin_percent.toString()).toBe("27.87");
    expect(hasil.profit_status).toBe("untung");
  });

  it("kembali ke angka lama begitu PB1 dicatat sebagai biaya yang disetorkan", () => {
    // Inti perubahan ini: yang menentukan bukan lagi rumusnya, melainkan
    // kenyataannya. PB1 disetorkan -> catat sebagai biaya, dan untungnya
    // sama persis dengan aturan lama yang hanya mengakui subtotal.
    const hasil = hitungMargin({
      penjualan: 43_325_000,
      biaya: [
        { estimated_amount: 18_000_000, actual_amount: 19_250_000 },
        { estimated_amount: 4_500_000 },
        { estimated_amount: 7_500_000, actual_amount: 7_500_000 },
        { actual_amount: 3_900_000 }, // PB1 disetor
        { actual_amount: 1_425_000 }, // Service charge diteruskan ke tim
      ],
    });

    expect(hasil.profit.toString()).toBe("6750000");
  });

  it("menandai rugi ketika biaya melampaui penjualan", () => {
    const hasil = hitungMargin({
      penjualan: 10_000_000,
      biaya: [{ actual_amount: 12_500_000 }],
    });

    expect(hasil.profit.toString()).toBe("-2500000");
    expect(hasil.margin_percent.toString()).toBe("-25");
    expect(hasil.profit_status).toBe("rugi");
  });

  it("tidak membagi dengan nol ketika invoice belum punya nilai", () => {
    const hasil = hitungMargin({ penjualan: 0, biaya: [{ actual_amount: 500_000 }] });
    expect(hasil.margin_percent.toString()).toBe("0");
    expect(hasil.profit_status).toBe("rugi");
  });
});

describe("Tampilan", () => {
  it("menulis rupiah dengan pemisah ribuan Indonesia", () => {
    expect(angka(43_325_000)).toBe("43.325.000");
    expect(rupiah(43_325_000)).toBe("Rp 43.325.000");
    expect(rupiah(0)).toBe("Rp 0");
  });

  it("membulatkan tampilan ke rupiah utuh", () => {
    expect(bulatkanRupiah("1500.5").toString()).toBe("1501");
    expect(angka("1500.4")).toBe("1.500");
  });

  it("membaca angka bergaya Indonesia", () => {
    // Titik adalah pemisah RIBUAN, bukan desimal. Ini kesalahan yang membuat
    // harga 85 ribu tersimpan jadi 85 rupiah.
    expect(uraikanRupiah("85.000")?.toString()).toBe("85000");
    expect(uraikanRupiah("1.250.000")?.toString()).toBe("1250000");
    expect(uraikanRupiah("85000")?.toString()).toBe("85000");
    expect(uraikanRupiah("2.500,75")?.toString()).toBe("2500.75");
    expect(uraikanRupiah(" 45.000 ")?.toString()).toBe("45000");
    expect(uraikanRupiah(0)?.toString()).toBe("0");
  });

  it("menolak isian yang bukan angka alih-alih diam-diam menjadikannya nol", () => {
    expect(uraikanRupiah("")).toBeNull();
    expect(uraikanRupiah("Rp 85.000")).toBeNull();
    expect(uraikanRupiah("delapan puluh lima ribu")).toBeNull();
    expect(uraikanRupiah(null)).toBeNull();
  });

  it("menomori grup item dengan angka Romawi seperti di dokumen cetak", () => {
    expect(romawi(1)).toBe("I");
    expect(romawi(4)).toBe("IV");
    expect(romawi(9)).toBe("IX");
    expect(romawi(14)).toBe("XIV");
    expect(romawi(40)).toBe("XL");
  });
});
