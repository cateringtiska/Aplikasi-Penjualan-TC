import { describe, expect, it } from "vitest";

import { barisTabelDokumen, barisTotalDokumen, type ItemCetak } from "./baris-cetak";

/* ==========================================================================
   SUSUNAN BARIS DOKUMEN

   Dipakai halaman cetak DAN berkas Excel yang diunduh dari dokumen yang
   sama. Salah di sini berarti kertas dan berkasnya sama-sama salah, dan
   keduanya sudah di tangan customer sebelum ada yang menyadarinya.
   ========================================================================== */

const induk = (ubah: Partial<ItemCetak> = {}): ItemCetak => ({
  id: "1",
  item_name: "LUNCH BUFFET",
  unit: "pax",
  day: "1",
  qty: "35",
  price: "100000",
  subtotal: "3500000",
  is_compliment: false,
  anak: [],
  ...ubah,
});

const anak = (ubah: Partial<ItemCetak["anak"][number]> = {}) => ({
  id: "a1",
  item_name: "VEGETARIAN",
  unit: "pax",
  day: "1",
  qty: "2",
  price: "100000",
  subtotal: "200000",
  ...ubah,
});

const item = (hasil: ReturnType<typeof barisTabelDokumen>, i: number) => {
  const b = hasil[i];
  if (b.jenis !== "item") throw new Error(`baris ke-${i} bukan item`);
  return b;
};

describe("baris judul", () => {
  it("ditentukan oleh ANGKANYA SENDIRI, bukan oleh anaknya", () => {
    /*
     * Inti perkaranya, dan pernah salah sungguhan.
     *
     * Aturan lamanya berbunyi "induk yang anaknya berharga adalah judul",
     * dan itu membuang empat baris LUNCH BUFFET dari sebuah quotation:
     * subtotalnya tercetak 17.830.000, padahal seharusnya 44.955.000.
     *
     * "LUNCH BUFFET 35 pax" yang punya tambahan "VEGETARIAN 2 pax" adalah
     * 37 porsi yang ditagihkan, bukan judul kelompok.
     */
    const hasil = barisTabelDokumen([induk({ anak: [anak()] })]);

    expect(item(hasil, 0).judul, "induk berharga dianggap judul").toBe(false);
    expect(item(hasil, 0).qty).toBe("35");
    expect(item(hasil, 0).nilaiAngka).toBe(3500000);
  });

  it("induk yang TIDAK menagih apa pun memang judul", () => {
    const hasil = barisTabelDokumen([
      induk({ item_name: "ANEKA STALL", qty: "0", price: "0", subtotal: "0", anak: [anak()] }),
    ]);

    expect(item(hasil, 0).judul).toBe(true);
  });

  it("kolom angkanya DIKOSONGKAN, bukan diisi nol", () => {
    // Nol terbaca sebagai harga, dan pembacanya akan mencari-cari apa yang
    // berharga nol. Di Excel ia ikut terbawa kalau kolomnya dijumlah.
    const hasil = barisTabelDokumen([
      induk({ qty: "0", price: "0", subtotal: "0", anak: [anak()] }),
    ]);
    const b = item(hasil, 0);

    expect([b.hari, b.qty, b.satuan, b.harga, b.nilai]).toEqual(["", "", "", "", ""]);
    expect([b.hariAngka, b.qtyAngka, b.hargaAngka, b.nilaiAngka]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("sub-item", () => {
  it("yang BERHARGA mendapat barisnya sendiri, bernomor I.1 dan I.2", () => {
    const hasil = barisTabelDokumen([
      induk({
        anak: [anak({ id: "a1" }), anak({ id: "a2", item_name: "TAMBAHAN NASI" })],
      }),
    ]);

    expect(item(hasil, 1).nomor).toBe("I.1");
    expect(item(hasil, 2).nomor).toBe("I.2");
    expect(item(hasil, 1).menjorok).toBe(true);
  });

  it("yang TIDAK berharga menumpang sebagai rincian isi paket", () => {
    // "LUNCH BOX" adalah paket berharga yang anaknya hanya menyebutkan
    // isinya: nasi putih, ayam, kerupuk. Itu bukan baris tagihan.
    const hasil = barisTabelDokumen([
      induk({
        item_name: "PREFFERED LUNCH BOX",
        anak: [
          anak({ id: "a1", item_name: "Nasi Putih", price: "0", subtotal: "0" }),
          anak({ id: "a2", item_name: "Kerupuk", price: "0", subtotal: "0" }),
        ],
      }),
    ]);

    // Tidak ada baris tersendiri untuk keduanya; namanya menumpang di kolom
    // deskripsi induknya. Baris "Total - I" tetap ada, persis seperti di
    // dokumen sungguhan pemiliknya.
    expect(hasil.filter((x) => x.jenis === "item")).toHaveLength(1);
    expect(item(hasil, 0).rincian).toEqual(["Nasi Putih", "Kerupuk"]);
  });
});

describe("total kelompok", () => {
  it("menjumlahkan induk beserta anaknya", () => {
    const hasil = barisTabelDokumen([induk({ anak: [anak()] })]);
    const total = hasil[hasil.length - 1];

    expect(total.jenis).toBe("totalKelompok");
    if (total.jenis !== "totalKelompok") return;

    expect(total.label).toBe("Total - I");
    expect(total.nilaiAngka).toBe(3700000);
  });

  it("TIDAK muncul untuk baris yang tidak punya anak", () => {
    // Total untuk satu baris hanya mengulang angka yang sudah ada tepat di
    // atasnya, dan membuat dokumennya lebih panjang tanpa menambah apa pun.
    const hasil = barisTabelDokumen([induk()]);
    expect(hasil.every((b) => b.jenis === "item")).toBe(true);
  });

  it("TIDAK muncul ketika kelompoknya tidak bernilai sama sekali", () => {
    // Permintaan pemiliknya: "kalau tidak ada angkanya, tidak perlu ada
    // totalnya".
    const hasil = barisTabelDokumen([
      induk({
        qty: "0",
        price: "0",
        subtotal: "0",
        anak: [anak({ price: "0", subtotal: "0" })],
      }),
    ]);

    expect(hasil.some((b) => b.jenis === "totalKelompok")).toBe(false);
  });
});

describe("compliment", () => {
  it("ditulis sebagai kata, dan tidak membawa angka ke Excel", () => {
    // Angka nol pada baris compliment akan ikut terjumlah di Excel, dan
    // yang membacanya mengira ada barang berharga nol.
    const hasil = barisTabelDokumen([induk({ is_compliment: true, anak: [anak()] })]);
    const b = item(hasil, 0);

    expect(b.harga).toBe("Compliment");
    expect(b.nilai).toBe("Compliment");
    expect(b.hargaAngka).toBeNull();
    expect(b.nilaiAngka).toBeNull();

    // Sub-itemnya ikut, sebab penanda compliment diwarisi dari induknya.
    expect(item(hasil, 1).nilaiAngka).toBeNull();
  });
});

describe("blok total", () => {
  const dasar = {
    subtotal: "8245000",
    service_charge_percent: "5.00",
    service_charge_amount: "412250",
    pb1_enabled: true,
    pb1_percent: "10.00",
    pb1_amount: "865725",
    delivery_amount: "0",
    biaya_tambahan: [],
    grand_total: "9522975",
  };

  it("menyebut persentasenya tanpa nol di belakang koma", () => {
    const hasil = barisTotalDokumen(dasar);
    expect(hasil.map((b) => b.label)).toEqual([
      "Sub Total",
      "Service Charge (5%)",
      "PB1 (10%)",
      "TOTAL",
    ]);
  });

  it("menaruh delivery dan biaya tambahan SESUDAH kedua pungutan", () => {
    // Supaya pembaca dokumen bisa menelusuri perhitungannya dari atas ke
    // bawah dan melihat sendiri bahwa ongkos kirim tidak ikut dipajaki.
    const hasil = barisTotalDokumen({
      ...dasar,
      delivery_amount: "250000",
      biaya_tambahan: [{ id: "1", label: "Pembulatan", amount: "-2975" }],
    });

    expect(hasil.map((b) => b.label)).toEqual([
      "Sub Total",
      "Service Charge (5%)",
      "PB1 (10%)",
      "Delivery",
      "Pembulatan",
      "TOTAL",
    ]);
  });

  it("menyembunyikan baris yang nilainya nol", () => {
    const hasil = barisTotalDokumen({
      ...dasar,
      service_charge_amount: "0",
      pb1_enabled: false,
      pb1_amount: "0",
    });

    expect(hasil.map((b) => b.label)).toEqual(["Sub Total", "TOTAL"]);
  });

  it("membiarkan biaya tambahan yang MINUS, sebab itu diskon atau pembulatan", () => {
    const hasil = barisTotalDokumen({
      ...dasar,
      biaya_tambahan: [{ id: "1", label: "Diskon", amount: "-500000" }],
    });

    const diskon = hasil.find((b) => b.label === "Diskon");
    expect(diskon?.nilaiAngka).toBe(-500000);
  });
});
