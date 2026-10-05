import { describe, expect, it } from "vitest";

import { cocokkanAlokasi } from "./alokasi-pembayaran";
import { d } from "./uang";

/* ==========================================================================
   APA YANG HARUS SAMA DENGAN APA

   Satu setoran boleh menutup beberapa invoice, dan jumlah alokasinya harus
   persis sebanyak yang dibayarkan. Yang membayar bukan hanya uang yang masuk
   ke rekening: PPh 23 yang ditahan customer juga sudah dibayarkan — ke kas
   negara, atas nama perusahaan, dengan bukti potong sebagai tandanya.

   Kalau aturannya menuntut alokasi sama dengan uang yang diterima saja,
   setiap pembayaran yang dipotong pajak menjadi mustahil dicatat. Satu-
   satunya jalan keluarnya adalah mencatat invoicenya kurang bayar, dan
   piutang itu tidak akan pernah bisa ditagih kepada siapa pun — customer
   sudah membayar penuh, dan negara tidak mengembalikannya ke rekening.
   ========================================================================== */

const cocok = (diterima: string, pph23: string, totalAlokasi: string) =>
  cocokkanAlokasi({ diterima: d(diterima), pph23: d(pph23), totalAlokasi: d(totalAlokasi) });

describe("cocokkanAlokasi", () => {
  it("menerima alokasi yang sama dengan uang masuk, tanpa potongan", () => {
    expect(cocok("5000000", "0", "5000000")).toBeNull();
  });

  it("MENERIMA alokasi yang lebih besar dari uang masuk sebesar PPh 23", () => {
    // Invoice 10 juta, dipotong 180.000, yang masuk 9.820.000.
    expect(cocok("9820000", "180000", "10000000")).toBeNull();
  });

  it("MENOLAK alokasi yang mengabaikan potongannya", () => {
    // Inilah yang terjadi kalau aturannya tidak ikut menghitung PPh 23:
    // invoicenya tercatat kurang bayar 180.000 selamanya.
    const pesan = cocok("9820000", "180000", "9820000");
    expect(pesan).not.toBeNull();
    expect(pesan).toContain("180000");
  });

  it("menyebutkan rinciannya hanya ketika ada potongan", () => {
    expect(cocok("5000000", "0", "4000000")).not.toContain("PPh 23");
    expect(cocok("5000000", "500000", "4000000")).toContain("PPh 23");
  });

  it("menyebutkan SELISIHNYA, ke arah mana pun", () => {
    expect(cocok("5000000", "0", "4000000")).toContain("Selisih 1000000");
    expect(cocok("5000000", "0", "6000000")).toContain("Selisih 1000000");
  });

  it("tidak menerima selisih satu rupiah pun", () => {
    expect(cocok("9820000", "180000", "9999999")).not.toBeNull();
    expect(cocok("9820000", "180000", "10000001")).not.toBeNull();
  });
});
