import { afterAll, describe, expect, it } from "vitest";

import { ambilLaporan } from "../lib/laporan-penjualan";
import { prisma } from "../lib/prisma";
import { d } from "../lib/uang";

/* ==========================================================================
   RINGKASAN LAPORAN PENJUALAN HARUS BISA DITELUSURI SENDIRI

   Kartu Dashboard menyebut "penjualan diakui", laporan cetaknya menyebut
   "nilai invoice", dan keduanya berbeda. Itu BENAR — nilai invoice memuat
   dokumen yang acaranya belum terjadi — tetapi tanpa rinciannya kedua
   angka terbaca seolah bertentangan, dan itu sudah pernah ditanyakan.

   Yang dijaga di sini adalah hubungan antar angkanya. Kalau salah satu
   menyimpang, tidak ada galat apa pun: laporannya tetap tercetak, hanya
   totalnya tidak lagi menjumlah ke rinciannya sendiri — dan yang
   membandingkannya adalah akuntan saat menutup bulan.
   ========================================================================== */

const KOSONG = { dari: "", sampai: "", pelanggan: "" };

afterAll(async () => {
  await prisma.$disconnect();
});

describe("nilai invoice terbagi habis", () => {
  it("sama dengan diakui + diterima di muka + proyeksi, sampai rupiahnya", async () => {
    const { ringkasan: r } = await ambilLaporan(KOSONG, {});

    const jumlah = d(r.penjualanDiakui)
      .plus(d(r.diterimaDiMuka))
      .plus(d(r.proyeksiPenjualan));

    expect(
      jumlah.toString(),
      "nilai invoice tidak menjumlah ke rinciannya sendiri",
    ).toBe(d(r.nilaiTagihan).toString());
  });

  it("tidak ada bagian yang minus", async () => {
    // Bagian yang minus akan membuat jumlahnya tetap cocok sementara satu
    // angkanya mustahil — dan "Proyeksi penjualan -Rp 5.000.000" di laporan
    // yang dibaca akuntan adalah angka yang tidak bisa dijelaskan.
    const { ringkasan: r } = await ambilLaporan(KOSONG, {});

    for (const [nama, nilai] of [
      ["penjualan diakui", r.penjualanDiakui],
      ["diterima di muka", r.diterimaDiMuka],
      ["proyeksi", r.proyeksiPenjualan],
      ["uang muka", r.uangMuka],
      ["piutang", r.totalPiutang],
    ] as const) {
      expect(d(nilai).isNegative(), nama).toBe(false);
    }
  });
});

describe("piutang hanya dari penjualan yang sudah diakui", () => {
  it("tidak pernah lebih besar daripada penjualan yang diakui", async () => {
    /*
     * Piutang adalah bagian penjualan diakui yang belum dibayar. Lebih
     * besar daripada penjualan yang diakui berarti ada dokumen yang
     * acaranya belum terjadi ikut terhitung sebagai tagihan berjalan —
     * dan umur piutangnya akan terbaca jauh lebih buruk daripada
     * keadaan sebenarnya.
     */
    const { ringkasan: r } = await ambilLaporan(KOSONG, {});

    expect(d(r.totalPiutang).lte(d(r.penjualanDiakui))).toBe(true);
  });

  it("selisihnya dengan nilai dikurangi terbayar bisa dijelaskan", async () => {
    /*
     * Pertanyaan yang muncul saat membaca laporannya: kenapa piutang tidak
     * sama dengan nilai invoice dikurangi yang sudah dibayar?
     *
     * Jawabannya: yang belum dibayar DAN acaranya belum terjadi tidak
     * dihitung sebagai piutang. Besarnya tepat proyeksi dikurangi uang
     * muka yang sudah masuk atasnya.
     */
    const { ringkasan: r } = await ambilLaporan(KOSONG, {});

    const belumDibayar = d(r.nilaiTagihan).minus(d(r.totalTerbayar));
    const belumJadiPiutang = d(r.proyeksiPenjualan).minus(d(r.uangMuka));

    expect(belumDibayar.minus(belumJadiPiutang).toString()).toBe(
      d(r.totalPiutang).toString(),
    );
  });
});

describe("yang dibatalkan tidak ikut", () => {
  it("jumlah tagihan aktif tidak memuat yang dibatalkan", async () => {
    const { ringkasan: r } = await ambilLaporan(KOSONG, {});

    const aktif = await prisma.invoices.count({ where: { status: { not: "cancelled" } } });
    expect(r.jumlahTagihan).toBe(aktif);
  });
});
