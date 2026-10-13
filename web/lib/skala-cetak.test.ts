import { describe, expect, it } from "vitest";

import { hitungSkalaMuat, labelSkala, PILIHAN_SKALA, SKALA_MINIMUM } from "./skala-cetak";

/* ==========================================================================
   MENGHITUNG SKALA SUPAYA DOKUMEN MUAT SATU HALAMAN

   Quotation dan invoice katering kadang hanya lebih panjang sedikit dari
   satu halaman, dan lembar keduanya hampir kosong.

   Seluruh kesalahan di sini TIDAK MENIMBULKAN GALAT. Dokumennya tetap
   tercetak; yang salah hanya berapa lembar keluarnya, atau seberapa kecil
   hurufnya — dan itu baru ketahuan setelah kertasnya keluar dari printer,
   atau setelah berkasnya sampai ke customer.
   ========================================================================== */

describe("dokumen yang sudah muat", () => {
  it("TIDAK diperkecil", () => {
    expect(hitungSkalaMuat(800, 1000)).toBe(1);
  });

  it("TIDAK dibesarkan, walaupun masih banyak ruang kosong", () => {
    // Membesarkan dokumen setengah halaman justru bisa mendorongnya
    // menjadi dua, dan tidak ada yang meminta hurufnya diperbesar.
    expect(hitungSkalaMuat(300, 1000)).toBe(1);
  });

  it("tepat sepanjang halamannya tetap 1", () => {
    expect(hitungSkalaMuat(1000, 1000)).toBe(1);
  });
});

describe("dokumen yang lewat sedikit", () => {
  it("diperkecil secukupnya saja", () => {
    // Lewat sepuluh persen: cukup diperkecil sekitar sepuluh persen.
    const skala = hitungSkalaMuat(1100, 1000);

    expect(skala).toBeLessThan(1);
    expect(skala).toBeGreaterThan(0.85);
  });

  it("hasilnya BENAR-BENAR muat, bukan pas-pasan", () => {
    /*
     * Pembulatan piksel browser bisa membuat dokumen yang dihitung "pas"
     * tetap tumpah satu baris ke halaman berikutnya — dan satu baris di
     * lembar kedua adalah persis keadaan yang hendak dihindari.
     */
    for (const tinggi of [1001, 1100, 1234, 1999, 2000]) {
      const skala = hitungSkalaMuat(tinggi, 1000);
      expect(tinggi * skala, `tinggi ${tinggi}`).toBeLessThanOrEqual(1000);
    }
  });
});

describe("dokumen yang terlalu panjang", () => {
  it("berhenti di batas bawah, tidak mengecil tanpa henti", () => {
    // Di bawah batas ini hurufnya sudah tidak terbaca orang yang menerima
    // dokumennya, dan dokumen yang tidak terbaca lebih buruk daripada
    // dokumen dua lembar.
    expect(hitungSkalaMuat(10_000, 1000)).toBe(SKALA_MINIMUM);
  });

  it("batas bawahnya masih separuh, bukan sekadar angka kecil", () => {
    expect(SKALA_MINIMUM).toBe(0.5);
  });
});

describe("ukuran yang tidak masuk akal", () => {
  it("dikembalikan ke 1, bukan nol atau tak hingga", () => {
    /*
     * Pengukuran bisa gagal: elemennya belum tergambar, atau halamannya
     * tersembunyi. Skala nol membuat dokumennya HILANG sama sekali dari
     * kertas, dan itu tidak akan terlihat sampai ada yang mencetaknya.
     */
    expect(hitungSkalaMuat(0, 1000)).toBe(1);
    expect(hitungSkalaMuat(1000, 0)).toBe(1);
    expect(hitungSkalaMuat(-5, 1000)).toBe(1);
    expect(hitungSkalaMuat(Number.NaN, 1000)).toBe(1);
    expect(hitungSkalaMuat(1000, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("pilihan yang ditawarkan", () => {
  it("seluruhnya di antara batas bawah dan 1", () => {
    for (const s of PILIHAN_SKALA) {
      expect(s, `${s}`).toBeGreaterThanOrEqual(SKALA_MINIMUM);
      expect(s, `${s}`).toBeLessThanOrEqual(1);
    }
  });

  it("menyertakan ukuran asli, supaya bisa dikembalikan", () => {
    expect(PILIHAN_SKALA).toContain(1);
  });

  it("disebutkan sebagai persen bulat", () => {
    expect(labelSkala(1)).toBe("100%");
    expect(labelSkala(0.86)).toBe("86%");
    expect(labelSkala(0.5)).toBe("50%");
  });
});
