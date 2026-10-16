import { describe, expect, it } from "vitest";

import { bacaAlasanPembatalan, MAX_ALASAN, MIN_ALASAN } from "./pembatalan";

/* ==========================================================================
   ALASAN PEMBATALAN

   Dokumen yang dibatalkan tetap ada di daftar dan tetap terhitung di
   laporan, tetapi tanpa keterangan kenapa. Beberapa minggu kemudian tidak
   seorang pun bisa menjawabnya — apakah customer yang membatalkan, apakah
   salah terbit, atau apakah digantikan dokumen lain. Yang bertanya biasanya
   customer itu sendiri, atau akuntan saat menutup bulan.
   ========================================================================== */

describe("yang ditolak", () => {
  it("kosong", () => {
    const hasil = bacaAlasanPembatalan("");
    expect(hasil.ok).toBe(false);
  });

  it("hanya spasi", () => {
    // Lolos dari pemeriksaan "tidak kosong" yang paling sederhana, lalu
    // tersimpan sebagai alasan yang TAMPAK terisi di database.
    expect(bacaAlasanPembatalan("   ").ok).toBe(false);
    expect(bacaAlasanPembatalan("\n\t ").ok).toBe(false);
  });

  it("tidak diisi sama sekali", () => {
    expect(bacaAlasanPembatalan(null).ok).toBe(false);
    expect(bacaAlasanPembatalan(undefined).ok).toBe(false);
  });

  it("terlalu pendek untuk menjelaskan apa pun", () => {
    /*
     * Bukan sekadar "tidak kosong": satu huruf atau satu titik lolos dari
     * pemeriksaan kosong tetapi tidak menjelaskan apa pun — dan isian yang
     * bisa dilewati dengan satu ketukan akan selalu dilewati.
     */
    expect(bacaAlasanPembatalan("x").ok).toBe(false);
    expect(bacaAlasanPembatalan(".").ok).toBe(false);
    expect(bacaAlasanPembatalan("abcd").ok).toBe(false);
  });

  it("melebihi batas panjangnya", () => {
    expect(bacaAlasanPembatalan("a".repeat(MAX_ALASAN + 1)).ok).toBe(false);
  });

  it("menyebutkan APA yang salah, bukan sekadar menolak", () => {
    // Penolakan tanpa keterangan hanya membuat pemakainya menekan tombol
    // yang sama berulang kali.
    const kosong = bacaAlasanPembatalan("");
    const pendek = bacaAlasanPembatalan("x");

    expect(kosong.ok || pendek.ok).toBe(false);
    if (!kosong.ok) expect(kosong.pesan).toMatch(/belum diisi/i);
    if (!pendek.ok) expect(pendek.pesan).toMatch(/pendek/i);
  });
});

describe("yang diterima", () => {
  it("alasan sungguhan", () => {
    const hasil = bacaAlasanPembatalan("Customer membatalkan acaranya");
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.alasan).toBe("Customer membatalkan acaranya");
  });

  it("tepat sepanjang batas terpendeknya", () => {
    const hasil = bacaAlasanPembatalan("a".repeat(MIN_ALASAN));
    expect(hasil.ok).toBe(true);
  });

  it("tepat sepanjang batas terpanjangnya", () => {
    expect(bacaAlasanPembatalan("a".repeat(MAX_ALASAN)).ok).toBe(true);
  });
});

describe("merapikan isiannya", () => {
  it("membuang spasi di ujung", () => {
    const hasil = bacaAlasanPembatalan("  Salah terbit  ");
    expect(hasil.ok && hasil.alasan).toBe("Salah terbit");
  });

  it("menyatukan spasi beruntun dan baris baru", () => {
    // Alasan yang disalin dari chat sering membawa baris baru. Tersimpan
    // apa adanya, ia merusak tata letak di halaman dokumennya.
    const hasil = bacaAlasanPembatalan("Diganti\n\nQUO-2026-0012    oleh customer");
    expect(hasil.ok && hasil.alasan).toBe("Diganti QUO-2026-0012 oleh customer");
  });

  it("menghitung panjangnya SESUDAH dirapikan", () => {
    // "a    " yang dirapikan menjadi "a" tidak boleh lolos hanya karena
    // sebelum dirapikan panjangnya cukup.
    expect(bacaAlasanPembatalan("a    ").ok).toBe(false);
  });
});
