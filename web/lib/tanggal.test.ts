import { describe, expect, it } from "vitest";

import { jumlahHariAcara, rapikanTanggal, ringkasTanggalAcara } from "./tanggal";

/* ==========================================================================
   MERINGKAS TANGGAL ACARA

   Yang dikunci di sini adalah kalimat yang DICETAK DI DOKUMEN dan dibaca
   customer. Salah di sini tidak membuat apa pun gagal — dokumennya tetap
   terbit, hanya menyebutkan hari yang keliru, dan itu baru ketahuan ketika
   orang katering datang pada hari yang salah.
   ========================================================================== */

const t = (teks: string) => new Date(`${teks}T00:00:00`);

describe("ringkasTanggalAcara", () => {
  it("satu hari ditulis apa adanya", () => {
    expect(ringkasTanggalAcara([t("2026-05-10")])).toBe("10 Mei 2026");
  });

  it("tanggal berurutan menjadi rentang", () => {
    expect(
      ringkasTanggalAcara([t("2026-05-10"), t("2026-05-11"), t("2026-05-12")]),
    ).toBe("10 – 12 Mei 2026");
  });

  it("tanggal MELONCAT didaftar, bukan dijadikan rentang", () => {
    // Inti perkaranya. Ditulis sebagai rentang, "10 – 15 Mei" menjanjikan
    // enam hari kepada customer untuk acara yang hanya tiga hari.
    expect(
      ringkasTanggalAcara([t("2026-05-10"), t("2026-05-12"), t("2026-05-15")]),
    ).toBe("10, 12 & 15 Mei 2026");
  });

  it("dua hari berurutan tetap rentang", () => {
    expect(ringkasTanggalAcara([t("2026-05-10"), t("2026-05-11")])).toBe("10 – 11 Mei 2026");
  });

  it("dua hari meloncat memakai dan", () => {
    expect(ringkasTanggalAcara([t("2026-05-10"), t("2026-05-12")])).toBe("10 & 12 Mei 2026");
  });

  it("rentang yang menyeberang bulan menyebut kedua bulannya", () => {
    expect(
      ringkasTanggalAcara([t("2026-04-30"), t("2026-05-01"), t("2026-05-02")]),
    ).toBe("30 April – 2 Mei 2026");
  });

  it("rentang yang menyeberang tahun menyebut kedua tahunnya", () => {
    expect(ringkasTanggalAcara([t("2026-12-31"), t("2027-01-01")])).toBe(
      "31 Desember 2026 – 1 Januari 2027",
    );
  });

  it("tanggal meloncat lintas bulan ditulis lengkap", () => {
    expect(ringkasTanggalAcara([t("2026-04-28"), t("2026-05-02")])).toBe(
      "28 April 2026 & 2 Mei 2026",
    );
  });

  it("urutan masukan tidak menentukan urutan cetaknya", () => {
    // Orang menambahkan tanggal sesuai ingatannya, bukan berurutan.
    expect(
      ringkasTanggalAcara([t("2026-05-15"), t("2026-05-10"), t("2026-05-12")]),
    ).toBe("10, 12 & 15 Mei 2026");
  });

  it("tanggal kembar dihitung sekali", () => {
    // Dua baris tanggal yang sama akan membuat acara tiga hari terbaca
    // empat hari, dan itu angka yang ikut tercetak.
    const daftar = [t("2026-05-10"), t("2026-05-10"), t("2026-05-11")];
    expect(ringkasTanggalAcara(daftar)).toBe("10 – 11 Mei 2026");
    expect(jumlahHariAcara(daftar)).toBe(2);
  });

  it("kosong berarti tidak ada tanggalnya", () => {
    expect(ringkasTanggalAcara([])).toBeNull();
    expect(jumlahHariAcara([])).toBe(0);
  });

  it("membuang tanggal yang tidak sah tanpa merusak sisanya", () => {
    const daftar = [new Date("bukan tanggal"), t("2026-05-10")];
    expect(ringkasTanggalAcara(daftar)).toBe("10 Mei 2026");
  });
});

describe("rapikanTanggal", () => {
  it("mengurutkan dan membuang yang kembar", () => {
    const hasil = rapikanTanggal([t("2026-05-12"), t("2026-05-10"), t("2026-05-12")]);
    expect(hasil.map((x) => x.getDate())).toEqual([10, 12]);
  });

  it("tidak mengubah daftar aslinya", () => {
    const asli = [t("2026-05-12"), t("2026-05-10")];
    rapikanTanggal(asli);
    expect(asli.map((x) => x.getDate())).toEqual([12, 10]);
  });
});
