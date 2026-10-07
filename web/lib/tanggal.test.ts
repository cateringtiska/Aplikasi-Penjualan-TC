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
    expect(ringkasTanggalAcara([t("2026-05-10")])).toBe("Minggu, 10 Mei 2026");
  });

  it("tanggal berurutan menjadi rentang", () => {
    expect(
      ringkasTanggalAcara([t("2026-05-10"), t("2026-05-11"), t("2026-05-12")]),
    ).toBe("Minggu 10 – Selasa 12 Mei 2026");
  });

  it("tanggal MELONCAT didaftar, bukan dijadikan rentang", () => {
    // Inti perkaranya. Ditulis sebagai rentang, "10 – 15 Mei" menjanjikan
    // enam hari kepada customer untuk acara yang hanya tiga hari.
    expect(
      ringkasTanggalAcara([t("2026-05-10"), t("2026-05-12"), t("2026-05-15")]),
    ).toBe("Minggu 10, Selasa 12 & Jumat 15 Mei 2026");
  });

  it("dua hari berurutan tetap rentang", () => {
    expect(ringkasTanggalAcara([t("2026-05-10"), t("2026-05-11")])).toBe("Minggu 10 – Senin 11 Mei 2026");
  });

  it("dua hari meloncat memakai dan", () => {
    expect(ringkasTanggalAcara([t("2026-05-10"), t("2026-05-12")])).toBe("Minggu 10 & Selasa 12 Mei 2026");
  });

  it("rentang yang menyeberang bulan menyebut kedua bulannya", () => {
    expect(
      ringkasTanggalAcara([t("2026-04-30"), t("2026-05-01"), t("2026-05-02")]),
    ).toBe("Kamis 30 April – Sabtu 2 Mei 2026");
  });

  it("rentang yang menyeberang tahun menyebut kedua tahunnya", () => {
    expect(ringkasTanggalAcara([t("2026-12-31"), t("2027-01-01")])).toBe(
      "Kamis 31 Desember 2026 – Jumat 1 Januari 2027",
    );
  });

  it("tanggal meloncat lintas bulan ditulis lengkap", () => {
    expect(ringkasTanggalAcara([t("2026-04-28"), t("2026-05-02")])).toBe(
      "Selasa 28 April 2026 & Sabtu 2 Mei 2026",
    );
  });

  it("urutan masukan tidak menentukan urutan cetaknya", () => {
    // Orang menambahkan tanggal sesuai ingatannya, bukan berurutan.
    expect(
      ringkasTanggalAcara([t("2026-05-15"), t("2026-05-10"), t("2026-05-12")]),
    ).toBe("Minggu 10, Selasa 12 & Jumat 15 Mei 2026");
  });

  it("tanggal kembar dihitung sekali", () => {
    // Dua baris tanggal yang sama akan membuat acara tiga hari terbaca
    // empat hari, dan itu angka yang ikut tercetak.
    const daftar = [t("2026-05-10"), t("2026-05-10"), t("2026-05-11")];
    expect(ringkasTanggalAcara(daftar)).toBe("Minggu 10 – Senin 11 Mei 2026");
    expect(jumlahHariAcara(daftar)).toBe(2);
  });

  it("kosong berarti tidak ada tanggalnya", () => {
    expect(ringkasTanggalAcara([])).toBeNull();
    expect(jumlahHariAcara([])).toBe(0);
  });

  it("membuang tanggal yang tidak sah tanpa merusak sisanya", () => {
    const daftar = [new Date("bukan tanggal"), t("2026-05-10")];
    expect(ringkasTanggalAcara(daftar)).toBe("Minggu, 10 Mei 2026");
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

describe("nama hari", () => {
  /*
   * Yang memesan katering memikirkan acaranya sebagai "hari Sabtu", bukan
   * sebagai "tanggal 10". Salah hari adalah kesalahan yang tidak bisa
   * diperbaiki pada hari kejadiannya, dan tanggal sendirian menuntut
   * penerimanya membuka kalender untuk memastikan.
   */
  it("disebut untuk SETIAP tanggal, bukan hanya yang pertama", () => {
    const hasil = ringkasTanggalAcara([t("2026-05-10"), t("2026-05-12"), t("2026-05-15")]);

    expect(hasil).toContain("Minggu");
    expect(hasil).toContain("Selasa");
    expect(hasil).toContain("Jumat");
  });

  it("menyebut hari yang BENAR menurut kalender", () => {
    // Nama hari yang salah lebih buruk daripada tidak ada sama sekali:
    // ia terbaca meyakinkan, dan tidak ada yang akan memeriksanya ulang.
    const harapan: [string, string][] = [
      ["2026-10-08", "Kamis"], // Invoice Telkomsat, acara 8 Oktober 2026.
      ["2026-01-01", "Kamis"],
      ["2026-05-10", "Minggu"],
      ["2026-12-31", "Kamis"],
      ["2027-01-01", "Jumat"],
    ];

    for (const [tanggal, hari] of harapan) {
      expect(ringkasTanggalAcara([t(tanggal)]), tanggal).toBe(
        `${hari}, ${new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(t(tanggal))}`,
      );
    }
  });

  it("satu tanggal memakai koma, yang lebih dari satu tidak", () => {
    // Koma pada bentuk jamak akan bertabrakan dengan koma pemisah antar
    // tanggal: "Minggu, 10, Selasa, 12 & Jumat, 15 Mei" tidak terbaca.
    expect(ringkasTanggalAcara([t("2026-05-10")])).toContain("Minggu, ");
    expect(ringkasTanggalAcara([t("2026-05-10"), t("2026-05-12")])).not.toContain("Minggu, ");
  });
});
