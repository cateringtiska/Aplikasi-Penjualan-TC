import { describe, expect, it } from "vitest";

import { bacaPax, barisUntukDisimpan, siapkanDokumen } from "./dokumen";

/* ==========================================================================
   PAX TIDAK PERNAH IKUT MENGHITUNG UANG

   Pax menerangkan BERAPA ORANG yang dilayani, sedangkan qty beserta
   satuannya menerangkan bentuk penyajiannya — 2 Tampah, 35 Box. Keduanya
   sering berbeda jauh: satu tampah bisa untuk dua puluh orang.

   Kalau pax sampai ikut terkalikan, nilai dokumen berubah TANPA ADA SATU
   PUN ANGKA HARGA YANG DISENTUH. Yang mengetiknya mengisi keterangan untuk
   dapur, dan totalnya diam-diam berlipat. Tidak ada layar yang akan
   menyebutkan sebabnya, sebab harga satuannya memang tidak berubah.
   ========================================================================== */

const muatan = (pax: string | undefined) => ({
  customer_id: "1",
  tanggal: "2026-10-08",
  tanggal_akhir: "2026-10-31",
  event_dates: ["2026-10-08"],
  items: [
    {
      item_name: "TAMPAH BATMAY",
      unit: "Tampah",
      day: "1",
      qty: "2",
      pax,
      price: "300000",
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

const siap = (pax: string | undefined) =>
  siapkanDokumen(muatan(pax), { labelTanggalAkhir: "Jatuh tempo" });

describe("pax tidak menyentuh angka uang", () => {
  it("nilai dokumennya sama, pax diisi berapa pun", () => {
    const tanpa = siap(undefined);
    const empatPuluh = siap("40");
    const seribu = siap("1000");

    expect(tanpa.ok && empatPuluh.ok && seribu.ok).toBe(true);
    if (!tanpa.ok || !empatPuluh.ok || !seribu.ok) return;

    // 2 Tampah x Rp 300.000 = Rp 600.000, apa pun isi kolom pax-nya.
    expect(tanpa.kolom.grand_total).toBe("600000.00");
    expect(empatPuluh.kolom.grand_total).toBe(tanpa.kolom.grand_total);
    expect(seribu.kolom.grand_total).toBe(tanpa.kolom.grand_total);

    expect(empatPuluh.kolom.subtotal).toBe(tanpa.kolom.subtotal);
    expect(seribu.kolom.subtotal).toBe(tanpa.kolom.subtotal);
  });

  it("subtotal yang TERSIMPAN per baris pun tidak berubah", () => {
    /*
     * Jalur kedua, dan hampir terlewat.
     *
     * Nilai dokumen dihitung di satu tempat, sedangkan subtotal yang
     * disimpan pada tiap baris dihitung di tempat lain. Memeriksa totalnya
     * saja membiarkan kebocoran di baris: dokumen lalu menagih angka yang
     * tidak sama dengan jumlah rinciannya sendiri, dan yang membandingkannya
     * adalah customer.
     */
    const tanpa = siap(undefined);
    const empatPuluh = siap("40");
    expect(tanpa.ok && empatPuluh.ok).toBe(true);
    if (!tanpa.ok || !empatPuluh.ok) return;

    const nilai = (hasil: typeof tanpa) =>
      hasil.ok ? barisUntukDisimpan(hasil.items).map((b) => b.induk.subtotal) : [];

    expect(nilai(tanpa)).toEqual(["600000.00"]);
    expect(nilai(empatPuluh)).toEqual(nilai(tanpa));
  });

  it("tetap tersimpan sebagai keterangannya", () => {
    const hasil = siap("40");
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.items[0].paxAngka).toBe(40);
    expect(hasil.items[0].qtyD.toString()).toBe("2");
  });
});

describe("membaca isian pax", () => {
  it("KOSONG berarti tidak diisi, bukan nol orang", () => {
    // Nol yang tersimpan akan tercetak di lembar dapur sebagai "0", dan itu
    // terbaca sebagai perintah untuk tidak memasaknya.
    expect(bacaPax("")).toBeNull();
    expect(bacaPax("   ")).toBeNull();
    expect(bacaPax(undefined)).toBeNull();
  });

  it("membaca angka yang diketik dengan pemisah ribuan", () => {
    expect(bacaPax("40")).toBe(40);
    expect(bacaPax("1.200")).toBe(1200);
  });

  it("menolak yang bukan bilangan bulat tidak negatif", () => {
    // Setengah orang tidak makan, dan pax minus tidak berarti apa-apa.
    expect(bacaPax("-5")).toBeNull();
    expect(bacaPax("2,5")).toBeNull();
    expect(bacaPax("dua puluh")).toBeNull();
  });

  it("menerima nol yang memang diketik", () => {
    // Berbeda dari kosong: ada yang sengaja menulisnya.
    expect(bacaPax("0")).toBe(0);
  });
});
