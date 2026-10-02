import { describe, expect, it } from "vitest";

import {
  angka,
  bulatkanRupiah,
  d,
  dasarServiceCharge,
  hitungMargin,
  hitungStatusInvoice,
  hitungSubtotal,
  hitungTotalDokumen,
  judulKelompok,
  labelStatusInvoice,
  nilaiBiaya,
  nilaiKelompok,
  perluTotalKelompok,
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

  it("menjumlahkan sub-item berharga ke dalam subtotal", () => {
    // Bentuk "ANEKA STALL": induknya judul kelompok tanpa angka, anaknya yang
    // membawa harga. Dipakai di dokumen katering sungguhan.
    const hasil = hitungTotalDokumen({
      items: [
        {
          qty: 0,
          price: 0,
          children: [
            { qty: 35, price: 50_000 }, // Bihun Iga Bakso
            { qty: 35, price: 39_000 }, // Siomay Bandung
          ],
        },
      ],
    });

    expect(hasil.subtotal.toString()).toBe("3115000"); // 1.750.000 + 1.365.000
    expect(hasil.grand_total.toString()).toBe("3115000");
  });

  it("tidak membuang angka induk hanya karena sub-itemnya berharga", () => {
    // Tes ini DULU menuntut sebaliknya, dengan alasan harga induk yang
    // sempat terisi akan terhitung dua kali. Dokumen sungguhan membantahnya:
    // "LUNCH BUFFET 35 pax" dengan sub-item "VEGETARIAN 2 pax" adalah 37
    // porsi yang ditagihkan, dan membuang induknya menghilangkan 35 porsi.
    //
    // Judul kelompok tidak perlu aturan khusus — qty kali harganya memang
    // sudah nol. Lihat "ANEKA STALL" di bawah.
    const hasil = hitungTotalDokumen({
      items: [
        {
          qty: 35,
          price: 150_000,
          children: [{ qty: 2, price: 150_000 }],
        },
      ],
    });

    expect(hasil.subtotal.toString()).toBe("5550000"); // 5.250.000 + 300.000
  });

  it("tetap menghitung paket berharga yang anaknya hanya rincian isi", () => {
    // Bentuk "LUNCH BOX": induknya berharga, anaknya tanpa angka. Keduanya
    // harus bekerja dengan aturan yang sama — setiap baris sebesar qty kali
    // harganya sendiri.
    const hasil = hitungTotalDokumen({
      items: [
        {
          qty: 35,
          price: 78_500,
          children: [{ qty: 0, price: 0 }, { qty: 0, price: 0 }],
        },
      ],
    });

    expect(hasil.subtotal.toString()).toBe("2747500");
  });

  it("sub-item mewarisi penanda pungutan dari induknya", () => {
    // Satu kelompok stall dikenai pungutan sebagai satu kesatuan. Kalau
    // anaknya tidak ikut mewarisi, dasar pungutannya hanya sebesar induk —
    // yang pada judul kelompok berarti NOL, dan pungutannya hilang diam-diam.
    const hasil = hitungTotalDokumen({
      items: [
        {
          qty: 0,
          price: 0,
          charge_service: true,
          charge_pb1: true,
          children: [{ qty: 35, price: 50_000 }],
        },
        {
          qty: 0,
          price: 0,
          charge_service: false,
          charge_pb1: false,
          children: [{ qty: 35, price: 39_000 }],
        },
      ],
      service_charge_percent: 10,
      pb1_enabled: true,
      pb1_percent: 10,
    });

    expect(hasil.subtotal.toString()).toBe("3115000");
    expect(hasil.dasar_service_charge.toString()).toBe("1750000");
    expect(hasil.dasar_pb1.toString()).toBe("1750000");
    expect(hasil.service_charge_amount.toString()).toBe("175000");
    expect(hasil.pb1_amount.toString()).toBe("175000");
  });

  it("menihilkan seluruh kelompok ketika induknya compliment", () => {
    const hasil = hitungTotalDokumen({
      items: [
        {
          qty: 0,
          price: 0,
          is_compliment: true,
          children: [{ qty: 35, price: 50_000 }],
        },
      ],
    });

    // Kelompok yang digratiskan harus nol seluruhnya, bukan hanya judulnya.
    expect(hasil.subtotal.toString()).toBe("0");
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

  it("menambahkan biaya tambahan ke total TANPA memajakinya", () => {
    // Angka dari dokumen sungguhan: subtotal 13.500.000, PB1 10%, lalu tiga
    // baris jasa yang kedudukannya sama dengan delivery — di luar kedua
    // pungutan. Menjadikannya baris item biasa akan membuatnya ikut kena
    // PB1, dan customer ditagih pajak atas jasa yang tidak dipajaki.
    const hasil = hitungTotalDokumen({
      items: [
        { qty: 100, price: 35_000 },
        { qty: 100, price: 100_000 },
      ],
      pb1_enabled: true,
      pb1_percent: 10,
      biaya_tambahan: [
        { label: "Tim Servis utk Menu Buffet (1 orang)", amount: 350_000 },
        { label: "Layanan Servis Penyediaan Coffee/ Tea & Buffet", amount: 2_700_000 },
        { label: "Tambahan Set-up & Layanan 1 Titik VIP Buffet", amount: 1_350_000 },
      ],
    });

    expect(hasil.subtotal.toString()).toBe("13500000");

    // PB1 dihitung dari 13.500.000 saja — bukan dari 17.900.000.
    expect(hasil.dasar_pb1.toString()).toBe("13500000");
    expect(hasil.pb1_amount.toString()).toBe("1350000");

    expect(hasil.biaya_tambahan_amount.toString()).toBe("4400000");
    expect(hasil.grand_total.toString()).toBe("19250000");
  });

  it("tidak mengubah dasar pungutan apa pun ketika biaya tambahan ditambah", () => {
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
      biaya_tambahan: [{ label: "Set-up panggung", amount: 500_000 }],
    });

    expect(dengan.dasar_service_charge.toString()).toBe(tanpa.dasar_service_charge.toString());
    expect(dengan.service_charge_amount.toString()).toBe(tanpa.service_charge_amount.toString());
    expect(dengan.dasar_pb1.toString()).toBe(tanpa.dasar_pb1.toString());
    expect(dengan.pb1_amount.toString()).toBe(tanpa.pb1_amount.toString());
    expect(dengan.subtotal.toString()).toBe(tanpa.subtotal.toString());

    expect(dengan.grand_total.minus(tanpa.grand_total).toString()).toBe("500000");
  });

  it("menjumlahkan delivery dan biaya tambahan berdampingan", () => {
    // Keduanya hidup bersama: delivery punya kolomnya sendiri, biaya
    // tambahan punya tabelnya sendiri. Totalnya harus memuat dua-duanya.
    const hasil = hitungTotalDokumen({
      items: [{ qty: 1, price: 1_000_000 }],
      delivery_amount: 250_000,
      biaya_tambahan: [
        { label: "Tim servis", amount: 350_000 },
        { label: "Set-up", amount: 150_000 },
      ],
    });

    expect(hasil.delivery_amount.toString()).toBe("250000");
    expect(hasil.biaya_tambahan_amount.toString()).toBe("500000");
    expect(hasil.grand_total.toString()).toBe("1750000");
  });

  it("memperlakukan biaya tambahan kosong sebagai nol", () => {
    const hasil = hitungTotalDokumen({ items: [{ qty: 1, price: 500_000 }] });
    expect(hasil.biaya_tambahan_amount.toString()).toBe("0");
    expect(hasil.grand_total.toString()).toBe("500000");
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

/* ==========================================================================
   TOTAL PER KELOMPOK

   Baris "Total - I" di bawah tiap kelompok bernomor Romawi. Isinya baris
   kelompok itu saja — PB1, service charge, delivery, dan biaya tambahan
   tetap dihitung sekali di bawah. Dengan begitu Sub Total SELALU sama persis
   dengan jumlah seluruh total kelompok; tidak ada pembulatan yang harus
   dicocokkan di dua tempat, dan tidak ada dokumen yang kolomnya tidak
   menjumlah menjadi totalnya sendiri.

   Yang dikunci paling keras: KAPAN BARIS ITU TIDAK MUNCUL.
   ========================================================================== */

describe("total per kelompok", () => {
  it("menjumlahkan induk dan seluruh sub-itemnya", () => {
    // Paket berharga: angkanya di induknya, sub-itemnya hanya daftar isi.
    const paket = { subtotal: "7605000", anak: [{ subtotal: "0" }, { subtotal: "0" }] };
    expect(nilaiKelompok(paket).toString()).toBe("7605000");

    // Judul kelompok: induknya nol, angkanya di sub-itemnya.
    const stall = { subtotal: "0", anak: [{ subtotal: "1382500" }, { subtotal: "1575000" }] };
    expect(nilaiKelompok(stall).toString()).toBe("2957500");
  });

  it("TIDAK memberi total pada kelompok yang tanpa angka", () => {
    // "STALL/ GUBUKAN - Menu dari Luar" dengan empat sub-item yang hanya
    // nama. Barisnya tidak menagih apa pun, dan "Total - II Rp 0" di
    // bawahnya hanya membuat pembacanya mencari-cari apa yang berharga nol.
    const daftarNama = {
      subtotal: "0",
      anak: [{ subtotal: "0" }, { subtotal: "0" }, { subtotal: "0" }, { subtotal: "0" }],
    };

    expect(nilaiKelompok(daftarNama).toString()).toBe("0");
    expect(perluTotalKelompok(daftarNama)).toBe(false);
  });

  it("TIDAK memberi total pada baris yang tidak punya sub-item", () => {
    // Nilainya sudah tertulis di baris itu sendiri; mengulanginya tepat di
    // bawahnya tidak menambah apa pun.
    expect(perluTotalKelompok({ subtotal: "2747500", anak: [] })).toBe(false);
  });

  it("memberi total pada kelompok yang punya angka, di kedua bentuknya", () => {
    expect(perluTotalKelompok({ subtotal: "7605000", anak: [{ subtotal: "0" }] })).toBe(true);
    expect(perluTotalKelompok({ subtotal: "0", anak: [{ subtotal: "1382500" }] })).toBe(true);
  });

  it("TIDAK memberi total pada kelompok compliment", () => {
    // Compliment tersimpan bernilai nol — ia tercetak, tetapi tidak menagih.
    expect(perluTotalKelompok({ subtotal: "0", anak: [{ subtotal: "0" }] })).toBe(false);
  });

  it("seluruh total kelompok berjumlah PERSIS sama dengan subtotal dokumen", () => {
    // Inilah akibat dari memilih "isi barisnya saja": tidak ada pembulatan
    // yang perlu dicocokkan, jadi kolomnya tidak mungkin tidak menjumlah.
    // Angka dari dokumen sungguhan: INV-2026-0015.
    const kelompok = [
      { subtotal: "7605000", anak: [{ subtotal: "0" }] },
      { subtotal: "27200000", anak: [{ subtotal: "0" }] },
    ];

    const jumlahKelompok = kelompok.reduce((j, k) => j.plus(nilaiKelompok(k)), d(0));

    const total = hitungTotalDokumen({
      items: [
        { qty: 130, price: 58_500, charge_service: false, charge_pb1: false },
        { qty: 160, price: 170_000 },
      ],
      service_charge_percent: 20,
      pb1_enabled: true,
      pb1_percent: 10,
      biaya_tambahan: [{ label: "Rounded (Diskon)", amount: -65_000 }],
    });

    expect(jumlahKelompok.toString()).toBe("34805000");
    expect(total.subtotal.toString()).toBe(jumlahKelompok.toString());

    // Sekalian: seluruh dokumennya harus menghasilkan 42.900.000.
    expect(total.service_charge_amount.toString()).toBe("5440000");
    expect(total.pb1_amount.toString()).toBe("2720000");
    expect(total.grand_total.toString()).toBe("42900000");
  });
});

/* ==========================================================================
   HARI SEBAGAI PENGALI BARIS

   Dokumen katering menghitung satu baris sebagai HARI x JUMLAH x HARGA.
   Acara tiga hari dengan 130 box per hari adalah 390 box — dan menuliskannya
   sebagai satu baris berjumlah 390 menghilangkan keterangan bahwa yang
   dipesan 130 per hari, yang justru itu yang dipakai dapur menyiapkannya.

   Yang paling keras dijaga: KOSONG BERARTI SATU, bukan nol. Kalau kosong
   terbaca nol, SELURUH dokumen yang sudah terbit mendadak bernilai nol —
   dan tetap terbit, hanya tidak menagih apa pun.
   ========================================================================== */

describe("hari sebagai pengali", () => {
  it("mengalikan hari, jumlah, dan harga", () => {
    // 3 hari x 130 box x 58.500
    expect(subtotalBaris({ day: 3, qty: 130, price: 58_500 }).toString()).toBe("22815000");
  });

  it("KOSONG BERARTI SATU, bukan nol", () => {
    // Inti penjagaannya. d() mengubah kosong menjadi nol, dan nol di sini
    // akan menolkan seluruh dokumen yang pernah terbit sebelum kolom ini ada.
    expect(subtotalBaris({ qty: 130, price: 58_500 }).toString()).toBe("7605000");
    expect(subtotalBaris({ day: null, qty: 130, price: 58_500 }).toString()).toBe("7605000");
    expect(subtotalBaris({ day: "", qty: 130, price: 58_500 }).toString()).toBe("7605000");
    expect(subtotalBaris({ day: 0, qty: 130, price: 58_500 }).toString()).toBe("7605000");
  });

  it("ikut mengalikan DASAR service charge dan PB1", () => {
    // Kalau hari hanya dipakai di subtotal, pungutannya akan dihitung dari
    // satu hari saja — dokumen menagih tiga hari tetapi memungut sehari.
    const hasil = hitungTotalDokumen({
      items: [{ day: 3, qty: 100, price: 100_000 }],
      service_charge_percent: 10,
      pb1_enabled: true,
      pb1_percent: 10,
    });

    expect(hasil.subtotal.toString()).toBe("30000000");
    expect(hasil.dasar_service_charge.toString()).toBe("30000000");
    expect(hasil.dasar_pb1.toString()).toBe("30000000");
    expect(hasil.service_charge_amount.toString()).toBe("3000000");
    expect(hasil.pb1_amount.toString()).toBe("3000000");
    expect(hasil.grand_total.toString()).toBe("36000000");
  });

  it("compliment tetap nol berapa pun harinya", () => {
    expect(subtotalBaris({ day: 5, qty: 10, price: 50_000, is_compliment: true }).toString()).toBe("0");
  });

  it("SUB-ITEM MEWARISI hari induknya", () => {
    // Satu stall yang disajikan tiga hari berarti seluruh isinya disajikan
    // tiga hari. Meminta angka hari di setiap sub-item hanya membuka peluang
    // keduanya menyimpang.
    const hasil = hitungTotalDokumen({
      items: [
        {
          day: 3,
          qty: 0,
          price: 0,
          children: [
            { qty: 35, price: 39_500 },
            { qty: 35, price: 45_000 },
          ],
        },
      ],
    });

    // 3 x (35 x 39.500 + 35 x 45.000) = 3 x 2.957.500
    expect(hasil.subtotal.toString()).toBe("8872500");
  });

  it("sub-item boleh menyebut harinya sendiri", () => {
    const hasil = hitungTotalDokumen({
      items: [{ day: 3, qty: 0, price: 0, children: [{ day: 1, qty: 35, price: 39_500 }] }],
    });

    expect(hasil.subtotal.toString()).toBe("1382500");
  });

  it("tidak mengubah satu pun dokumen yang ditulis tanpa hari", () => {
    // Angka dari INV-2026-0015, seluruhnya tanpa kolom hari.
    const total = hitungTotalDokumen({
      items: [
        { qty: 130, price: 58_500, charge_service: false, charge_pb1: false },
        { qty: 160, price: 170_000 },
      ],
      service_charge_percent: 20,
      pb1_enabled: true,
      pb1_percent: 10,
      biaya_tambahan: [{ label: "Rounded (Diskon)", amount: -65_000 }],
    });

    expect(total.subtotal.toString()).toBe("34805000");
    expect(total.grand_total.toString()).toBe("42900000");
  });
});

/* ==========================================================================
   INDUK BERHARGA YANG SUB-ITEMNYA JUGA BERHARGA

   Dilaporkan pemiliknya dari quotation sungguhan empat hari. Subtotalnya
   terbaca 17.830.000 padahal seharusnya 44.955.000 — dan karena PB1
   dihitung dari dasar yang sama, pajaknya ikut salah.

   Sebabnya: aturan lama menganggap "punya sub-item berharga" berarti
   induknya cuma judul, lalu MEMBUANG angka induknya. Pada dokumen ini
   setiap "LUNCH BUFFET 35 pax" punya sub-item "VEGETARIAN 2 pax", jadi
   keempat buffetnya hilang seluruhnya.

   Aturan yang benar ditentukan oleh angka barisnya sendiri: judul adalah
   baris yang tidak menagih apa pun. Baris yang punya qty dan harga adalah
   baris berharga, berapa pun sub-itemnya.
   ========================================================================== */

describe("induk berharga dengan sub-item berharga", () => {
  /** Angka persis dari quotation yang dilaporkan. */
  const DOKUMEN = {
    items: [
      // 4 hari x 37 pax x 55.000 = 8.140.000, sub-itemnya hanya daftar nama.
      {
        day: 4,
        qty: 37,
        price: 55_000,
        children: [{ qty: "", price: "" }, { qty: "", price: "" }],
      },
      // Empat buffet, masing-masing dengan tambahan porsi vegetarian.
      { day: 1, qty: 35, price: 150_000, children: [{ day: 1, qty: 2, price: 150_000 }] },
      { day: 1, qty: 35, price: 190_000, children: [{ day: 1, qty: 2, price: 190_000 }] },
      { day: 1, qty: 35, price: 190_000, children: [{ day: 1, qty: 2, price: 190_000 }] },
      { day: 1, qty: 35, price: 245_000, children: [{ day: 1, qty: 2, price: 245_000 }] },
      { day: 4, qty: 37, price: 55_000 },
    ],
  };

  it("menjumlahkan induk DAN sub-itemnya, bukan salah satunya", () => {
    const hasil = hitungTotalDokumen(DOKUMEN);

    // 8.140.000 + 5.250.000 + 300.000 + 6.650.000 + 380.000
    //          + 6.650.000 + 380.000 + 8.575.000 + 490.000 + 8.140.000
    expect(hasil.subtotal.toString()).toBe("44955000");
  });

  it("menghitung PB1 dari dasar yang utuh", () => {
    // Inti akibatnya. Dasar yang menyusut membuat pajaknya ikut salah, dan
    // dokumennya tetap terbit dengan angka yang kelihatan wajar.
    const hasil = hitungTotalDokumen({ ...DOKUMEN, pb1_enabled: true, pb1_percent: 10 });

    expect(hasil.dasar_pb1.toString()).toBe("44955000");
    expect(hasil.pb1_amount.toString()).toBe("4495500");
    expect(hasil.grand_total.toString()).toBe("49450500");
  });

  it("baris yang memang judul tetap bernilai nol", () => {
    // "ANEKA STALL": qty-nya masih 1 dari bawaan formulir, harganya kosong.
    const hasil = hitungTotalDokumen({
      items: [
        {
          qty: 1,
          price: "",
          children: [
            { qty: 35, price: 39_500 },
            { qty: 35, price: 45_000 },
          ],
        },
      ],
    });

    expect(hasil.subtotal.toString()).toBe("2957500");
    expect(judulKelompok({ qty: 1, price: "" })).toBe(true);
  });

  it("membedakan judul dari baris berharga lewat angkanya sendiri", () => {
    expect(judulKelompok({ qty: 0, price: 0 })).toBe(true);
    expect(judulKelompok({ qty: 1, price: 0 })).toBe(true);
    expect(judulKelompok({ qty: 0, price: 150_000 })).toBe(true);
    expect(judulKelompok({ qty: 35, price: 150_000 })).toBe(false);
  });
});
