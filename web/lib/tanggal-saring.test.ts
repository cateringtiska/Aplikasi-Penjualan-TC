import { describe, expect, it } from "vitest";

import { tanggalSiapDisaring } from "./bentuk-form";

/* ==========================================================================
   TAHUN YANG BELUM SELESAI DIKETIK

   Penyaring laporan mengendalikan isian tanggalnya dari alamat halaman, dan
   setiap perubahan langsung memindahkan alamatnya. Mengetik tahun "2026"
   angka demi angka membuat browser melaporkan "0002-09-30" begitu angka
   pertama masuk — halaman berpindah, isiannya digambar ulang dari alamat
   yang baru, dan tiga angka sisanya tidak pernah sampai.

   Yang terlihat pemakainya: tanggalnya terkunci di tahun 0002 dan seluruh
   angka laporannya nol. TIDAK ADA GALAT APA PUN. Laporannya terbuka
   dengan rapi, hanya menampilkan rentang tanggal yang mustahil.
   ========================================================================== */

describe("isian tanggal penyaring", () => {
  it("MENOLAK tahun yang belum selesai diketik", () => {
    // Inilah yang dilaporkan pemiliknya: "09/30/0002".
    expect(tanggalSiapDisaring("0002-09-30")).toBe(false);
    expect(tanggalSiapDisaring("0020-09-30")).toBe(false);
    expect(tanggalSiapDisaring("0202-09-30")).toBe(false);
  });

  it("MENERIMA tahun yang sudah lengkap", () => {
    expect(tanggalSiapDisaring("2026-09-30")).toBe(true);
    expect(tanggalSiapDisaring("1999-01-01")).toBe(true);
  });

  it("menerima kosong, sebab itulah cara melepas penyaringnya", () => {
    // Menolak yang kosong akan membuat penyaringnya tidak bisa dihapus
    // selain lewat tombol Reset.
    expect(tanggalSiapDisaring("")).toBe(true);
  });

  it("menolak bentuk yang bukan tanggal sama sekali", () => {
    expect(tanggalSiapDisaring("2026-09")).toBe(false);
    expect(tanggalSiapDisaring("30/09/2026")).toBe(false);
    expect(tanggalSiapDisaring("bukan tanggal")).toBe(false);
  });

  it("melewatkan seluruh langkah mengetik 2026, dan hanya yang terakhir lolos", () => {
    /*
     * Urutan sebenarnya yang dilaporkan browser ketika seseorang mengetik
     * tahun satu per satu pada tanggal 30 September. Hanya langkah terakhir
     * yang boleh memindahkan halaman.
     */
    const langkah = ["0002-09-30", "0020-09-30", "0202-09-30", "2026-09-30"];
    const lolos = langkah.filter(tanggalSiapDisaring);

    expect(lolos).toEqual(["2026-09-30"]);
  });
});
