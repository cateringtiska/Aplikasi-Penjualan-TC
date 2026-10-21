import { describe, expect, it } from "vitest";

import { ringkasTanggalAcaraPendek } from "./tanggal";

/* ==========================================================================
   TANGGAL ACARA DI KOLOM DAFTAR

   Bentuk panjangnya dibuat untuk dokumen yang dibaca satu per satu.
   Ditaruh di kolom tabel, kalimat sepanjang itu membungkus menjadi tiga
   baris dan membuat seluruh daftar tiga kali lebih tinggi.
   ========================================================================== */

const t = (teks: string) => new Date(`${teks}T00:00:00`);

describe("ringkasTanggalAcaraPendek", () => {
  it("kosong ketika tidak ada tanggalnya, supaya pemanggilnya bisa menyembunyikannya", () => {
    expect(ringkasTanggalAcaraPendek([])).toBeNull();
  });

  it("menulis satu tanggal apa adanya", () => {
    expect(ringkasTanggalAcaraPendek([t("2026-05-10")])).toBe("10 Mei 2026");
  });

  it("menyebut bulan dan tahunnya SEKALI pada rentang dalam satu bulan", () => {
    expect(
      ringkasTanggalAcaraPendek([t("2026-05-10"), t("2026-05-11"), t("2026-05-12")]),
    ).toBe("10 – 12 Mei 2026");
  });

  it("menyebut tahunnya sekali pada rentang yang berpindah bulan", () => {
    expect(ringkasTanggalAcaraPendek([t("2026-04-30"), t("2026-05-01")])).toBe(
      "30 Apr – 1 Mei 2026",
    );
  });

  it("menyebut keduanya lengkap pada rentang yang berpindah tahun", () => {
    expect(ringkasTanggalAcaraPendek([t("2026-12-31"), t("2027-01-01")])).toBe(
      "31 Des 2026 – 1 Jan 2027",
    );
  });

  it("menyebut JUMLAH HARINYA ketika tanggalnya meloncat, bukan merangkai satu per satu", () => {
    // Daftar tanggal yang memanjang mengembalikan persis masalah yang
    // membuat bentuk pendek ini ada.
    expect(
      ringkasTanggalAcaraPendek([t("2026-05-10"), t("2026-05-12"), t("2026-05-15")]),
    ).toBe("10 Mei 2026 · 3 hari");
  });

  it("tidak menyebut nama hari, berbeda dengan bentuk panjangnya", () => {
    const hasil = ringkasTanggalAcaraPendek([t("2026-05-10")])!;
    for (const h of ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]) {
      expect(hasil, `menyebut "${h}"`).not.toContain(h);
    }
  });

  it("mengurutkan dan membuang yang kembar sebelum meringkas", () => {
    expect(
      ringkasTanggalAcaraPendek([t("2026-05-12"), t("2026-05-10"), t("2026-05-11"), t("2026-05-10")]),
    ).toBe("10 – 12 Mei 2026");
  });
});
