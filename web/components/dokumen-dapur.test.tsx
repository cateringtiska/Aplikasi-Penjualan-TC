import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DokumenDapur, type IsiDapur } from "./dokumen-dapur";

/* ==========================================================================
   SURAT PESANAN DAPUR TIDAK BOLEH MEMBAWA ANGKA UANG

   Lembar ini beredar di dapur, ikut dibawa pengantar, dan tidak jarang
   tertinggal di tempat acara — di tangan tamu, pengelola gedung, atau
   vendor lain. Harga jual yang ikut terbaca di situ adalah kebocoran yang
   tidak bisa ditarik kembali.

   Kebocorannya TIDAK AKAN TERLIHAT dari layar mana pun: lembarnya tetap
   tercetak rapi, isinya tetap benar, hanya ada satu kolom lebih yang
   seharusnya tidak ada. Yang menemukannya adalah orang yang memegang
   kertasnya.

   Angka-angka ujinya sengaja dibuat ganjil dan tidak mungkin muncul
   kebetulan, supaya pencariannya tidak salah menuduh.
   ========================================================================== */

afterEach(cleanup);

const HARGA_SATUAN = "137911";
const NILAI_BARIS = "5516440";
const HARGA_ANAK = "248377";
const NILAI_ANAK = "496754";

const ISI: IsiDapur = {
  nomor: "INV-2026-0026",
  labelNomor: "No. Invoice",
  pemesan: "Telkomsat",
  alamat: "Jl. Sholeh Iskandar No.KM 6, Bogor",
  kontak: { nama: "Ibu Rachma", telepon: "0813-1163-7295" },
  acara: {
    tanggal: [new Date("2026-10-08T00:00:00")],
    jenis: "Gathering",
    jam: "10.30 WIB",
    venue: "Telkomsat Bogor",
    tamu: 50,
  },
  baris: [
    {
      id: "1",
      item_name: "ANEKA STALL",
      unit: null,
      day: "1",
      qty: "0",
      price: "0",
      subtotal: "0",
      is_compliment: false,
      anak: [
        {
          id: "a1",
          item_name: "Soto Mie",
          unit: "pax",
          day: "1",
          qty: "40",
          price: HARGA_ANAK,
          subtotal: NILAI_ANAK,
        },
      ],
    },
    {
      id: "2",
      item_name: "PREFFERED LUNCH BOX",
      unit: "box",
      day: "1",
      qty: "40",
      price: HARGA_SATUAN,
      subtotal: NILAI_BARIS,
      is_compliment: false,
      anak: [
        {
          id: "a2",
          item_name: "Nasi Putih",
          unit: null,
          day: "1",
          qty: "0",
          price: "0",
          subtotal: "0",
        },
      ],
    },
  ],
  catatan: "Tanpa pedas untuk 5 box.",
  namaPerusahaan: "PT. Tiska Cipta Imaji",
};

/** Seluruh teks lembarnya, tanpa pemisah ribuan dan spasi. */
function teksLembar(): string {
  return (document.body.textContent ?? "").replace(/[.\s,]/g, "");
}

describe("kebocoran harga", () => {
  it("TIDAK memuat harga satuan maupun nilai baris mana pun", () => {
    render(<DokumenDapur isi={ISI} />);
    const teks = teksLembar();

    for (const angka of [HARGA_SATUAN, NILAI_BARIS, HARGA_ANAK, NILAI_ANAK]) {
      expect(teks, `angka ${angka} bocor ke lembar dapur`).not.toContain(angka);
    }
  });

  it("tidak memuat kata Rp sama sekali", () => {
    // Penjaga kedua, yang menangkap bentuk uang yang angkanya kebetulan
    // tidak sama dengan contoh di atas.
    render(<DokumenDapur isi={ISI} />);
    expect(document.body.textContent ?? "").not.toContain("Rp");
  });

  it("tidak memuat baris Total apa pun", () => {
    // Total kelompok, Sub Total, Service Charge, PB1, dan TOTAL seluruhnya
    // angka uang. Judulnya saja sudah cukup mengundang pertanyaan di dapur.
    render(<DokumenDapur isi={ISI} />);
    const teks = document.body.textContent ?? "";

    expect(teks).not.toContain("Total");
    expect(teks).not.toContain("Sub Total");
    expect(teks).not.toContain("Service Charge");
    expect(teks).not.toContain("PB1");
  });
});

describe("yang memang harus ada", () => {
  it("memuat seluruh keterangan yang diminta dapur", () => {
    render(<DokumenDapur isi={ISI} />);

    expect(screen.getByText("Telkomsat")).toBeTruthy();
    expect(screen.getByText(/Jl. Sholeh Iskandar/)).toBeTruthy();
    expect(screen.getByText(/Kamis, 8 Oktober 2026/)).toBeTruthy();
    expect(screen.getByText("Gathering")).toBeTruthy();
    expect(screen.getByText("10.30 WIB")).toBeTruthy();
    expect(screen.getByText("1 hari")).toBeTruthy();
  });

  it("memuat menunya beserta hari, jumlah, dan satuannya", () => {
    render(<DokumenDapur isi={ISI} />);

    const baris = screen.getByText("PREFFERED LUNCH BOX").closest("tr");
    const kolom = Array.from(baris?.querySelectorAll("td") ?? []).map((td) =>
      (td.textContent ?? "").trim(),
    );

    // No, Menu, Hari, Jumlah, Satuan — lima kolom, tidak lebih.
    expect(kolom).toHaveLength(5);
    expect(kolom[0]).toBe("II");
    expect(kolom[2]).toBe("1");
    expect(kolom[3]).toBe("40");
    expect(kolom[4]).toBe("box");
  });

  it("tabel menunya hanya punya LIMA kolom", () => {
    // Kolom keenam di tabel ini hampir pasti harga. Dihitung dari kepala
    // tabelnya, supaya penambahan kolom apa pun harus disengaja.
    render(<DokumenDapur isi={ISI} />);

    const kepala = screen.getByText("Menu").closest("tr");
    const judul = Array.from(kepala?.querySelectorAll("th") ?? []).map((th) =>
      (th.textContent ?? "").trim(),
    );

    expect(judul).toEqual(["No", "Menu", "Hari", "Jumlah", "Satuan"]);
  });

  it("menyebutkan isi paket yang tidak berharga, sebab dapur memasaknya", () => {
    render(<DokumenDapur isi={ISI} />);
    expect(screen.getByText("- Nasi Putih")).toBeTruthy();
  });

  it("membawa catatannya, karena di situlah permintaan khusus ditulis", () => {
    render(<DokumenDapur isi={ISI} />);
    expect(screen.getByText("Tanpa pedas untuk 5 box.")).toBeTruthy();
  });

  it("menuliskan judul kelompok tanpa jumlah, bukan dengan angka nol", () => {
    // Nol di kolom jumlah akan terbaca dapur sebagai "tidak usah dimasak".
    render(<DokumenDapur isi={ISI} />);

    const baris = screen.getByText("ANEKA STALL").closest("tr");
    const kolom = Array.from(baris?.querySelectorAll("td") ?? []).map((td) =>
      (td.textContent ?? "").trim(),
    );

    expect(kolom[3]).toBe("");
  });
});
