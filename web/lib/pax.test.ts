import { describe, expect, it } from "vitest";

import { bacaPax, barisUntukDisimpan, siapkanDokumen } from "./dokumen";
import { hitungTotalDokumen } from "./uang";

/* ==========================================================================
   PAX ADALAH PENGALI NILAI BARIS

   Satu baris dokumen katering dihitung sebagai

       HARI x QTY x PAX x HARGA SATUAN

   Pax membawa banyaknya pesanan — 236 box, 150 porsi, 3 ekor — sedangkan
   qty pengalinya, dan hampir selalu satu.

   KOSONG BERARTI SATU, BUKAN NOL, dan di situlah seluruh bahayanya. Nol
   yang ikut terkali membuat nilai baris menjadi nol tanpa ada satu pun
   angka harga yang berubah; dan kalau kosong tidak diperlakukan sebagai
   satu, SELURUH dokumen yang terbit sebelum kolom ini ada berubah nilainya
   sekaligus — tiga puluh dokumen yang angkanya sudah ditagihkan ke
   customer.

   Aturan itu ada di DUA tempat: rumus dokumen di lib/uang.ts, dan angka
   yang disimpan per baris di lib/dokumen.ts. Keduanya diuji di sini.
   ========================================================================== */

const muatan = (pax: string | undefined, qty = "2") => ({
  customer_id: "1",
  tanggal: "2026-10-08",
  tanggal_akhir: "2026-10-31",
  event_dates: ["2026-10-08"],
  items: [
    {
      item_name: "PREFERED LUNCH BOX",
      unit: "box",
      day: "1",
      qty,
      pax,
      price: "58500",
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
});

const siap = (pax: string | undefined, qty = "2") =>
  siapkanDokumen(muatan(pax, qty), { labelTanggalAkhir: "Jatuh tempo" });

describe("rumus satu baris", () => {
  it("mengalikan hari, qty, pax, dan harga satuan", () => {
    // Contoh dari dokumen pemiliknya: 1 hari x 1 x 236 box x Rp 58.500
    // = Rp 13.806.000.
    const hasil = siap("236", "1");
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.kolom.grand_total).toBe("13806000.00");
  });

  it("menghitung angka yang sama untuk nilai yang TERSIMPAN per baris", () => {
    // Dua tempat menghitung nilai baris. Kalau keduanya berbeda, dokumen
    // menagih angka yang tidak sama dengan jumlah rinciannya sendiri.
    const hasil = siap("236", "1");
    if (!hasil.ok) return;

    expect(barisUntukDisimpan(hasil.items).map((b) => b.induk.subtotal)).toEqual([
      "13806000.00",
    ]);
  });
});

describe("pax kosong berarti satu", () => {
  it("menghasilkan nilai yang SAMA PERSIS dengan sebelum kolom pax ada", () => {
    /*
     * Inti jaminannya. Sebelum kolom pax ada, nilai baris adalah
     * hari x qty x harga. Pax kosong harus menghasilkan angka itu juga —
     * kalau tidak, tiga puluh dokumen yang sudah ditagihkan berubah
     * nilainya sekaligus, tanpa ada yang menyentuhnya.
     */
    const tanpa = siap(undefined, "2");
    expect(tanpa.ok).toBe(true);
    if (!tanpa.ok) return;

    // 1 hari x 2 box x Rp 58.500 = Rp 117.000.
    expect(tanpa.kolom.grand_total).toBe("117000.00");
    expect(barisUntukDisimpan(tanpa.items).map((b) => b.induk.subtotal)).toEqual(["117000.00"]);
  });

  it("pax satu memberi angka yang sama dengan pax kosong", () => {
    const kosong = siap(undefined, "2");
    const satu = siap("1", "2");
    if (!kosong.ok || !satu.ok) return;

    expect(satu.kolom.grand_total).toBe(kosong.kolom.grand_total);
  });

  it("pax NOL tidak menolkan nilainya", () => {
    // Nol yang ikut terkali membuat barisnya bernilai nol tanpa ada satu
    // pun angka harga yang berubah — dan dokumennya tetap tercetak rapi.
    const nol = siap("0", "2");
    const kosong = siap(undefined, "2");
    if (!nol.ok || !kosong.ok) return;

    expect(nol.kolom.grand_total).toBe(kosong.kolom.grand_total);
  });
});

describe("pax pada sub-item", () => {
  it("TIDAK diwarisi dari induknya", () => {
    /*
     * Satu stall berisi 150 porsi sate dan 3 ekor kambing guling. Pax yang
     * menurun dari induknya akan menagih tiga ekor kambing sebanyak seratus
     * lima puluh kali.
     */
    const hasil = hitungTotalDokumen({
      items: [
        {
          day: "1",
          qty: "1",
          pax: "150",
          price: "45000",
          children: [{ day: "1", qty: "1", pax: "3", price: "3500000" }],
        },
      ],
      pb1_enabled: false,
      delivery_amount: "0",
      biaya_tambahan: [],
    });

    // 150 x 45.000 = 6.750.000, ditambah 3 x 3.500.000 = 10.500.000.
    expect(hasil.subtotal.toString()).toBe("17250000");
  });

  it("sub-item tanpa pax tetap bernilai qty x harga", () => {
    const hasil = hitungTotalDokumen({
      items: [
        {
          day: "1",
          qty: "0",
          price: "0",
          children: [{ day: "1", qty: "35", price: "100000" }],
        },
      ],
      pb1_enabled: false,
      delivery_amount: "0",
      biaya_tambahan: [],
    });

    expect(hasil.subtotal.toString()).toBe("3500000");
  });
});

describe("membaca isian pax", () => {
  it("KOSONG berarti tidak diisi", () => {
    expect(bacaPax("")).toBeNull();
    expect(bacaPax("   ")).toBeNull();
    expect(bacaPax(undefined)).toBeNull();
  });

  it("membaca angka yang diketik dengan pemisah ribuan", () => {
    expect(bacaPax("236")).toBe(236);
    expect(bacaPax("1.200")).toBe(1200);
  });

  it("menolak yang bukan bilangan bulat tidak negatif", () => {
    // Setengah pesanan tidak ada, dan pax minus akan mengurangi nilai
    // dokumen tanpa ada diskon yang tercatat di mana pun.
    expect(bacaPax("-5")).toBeNull();
    expect(bacaPax("2,5")).toBeNull();
    expect(bacaPax("dua ratus")).toBeNull();
  });
});
