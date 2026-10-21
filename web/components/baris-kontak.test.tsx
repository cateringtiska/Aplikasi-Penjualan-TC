import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BarisKontak } from "./baris-kontak";

/* ==========================================================================
   KETERANGAN DI BAWAH NAMA CUSTOMER

   Satu baris kecil yang menanggung tiga hal: siapa yang dihubungi, acaranya
   apa, dan kapan. Aturannya sepele, tetapi satu hal mudah menyimpang:
   barisnya HILANG ketika semuanya kosong, bukan mencetak tanda hubung atau
   ruang kosong yang membuat tabelnya terlihat bolong.
   ========================================================================== */

describe("BarisKontak", () => {
  it("merangkai PIC, acara, dan tanggalnya", () => {
    render(<BarisKontak pic="Ibu Elsa" acara="Gathering" tanggalAcara="24 Okt 2026" />);
    expect(screen.getByText("Ibu Elsa · Gathering · 24 Okt 2026")).toBeTruthy();
  });

  it("melewati bagian yang kosong tanpa meninggalkan pemisah menggantung", () => {
    render(<BarisKontak pic={null} acara="Gathering" tanggalAcara="24 Okt 2026" />);
    expect(screen.getByText("Gathering · 24 Okt 2026")).toBeTruthy();
  });

  it("tetap bekerja tanpa tanggal, sebab dokumen lama tidak menyimpannya", () => {
    render(<BarisKontak pic="Ibu Elsa" acara="Gathering" />);
    expect(screen.getByText("Ibu Elsa · Gathering")).toBeTruthy();
  });

  it("HILANG ketika tidak ada apa pun, bukan mencetak baris kosong", () => {
    const { container } = render(
      <BarisKontak pic={null} acara={null} tanggalAcara={null} />,
    );
    expect(container.textContent).toBe("");
  });

  it("tidak menganggap spasi sebagai isi", () => {
    const { container } = render(<BarisKontak pic="  " acara="" tanggalAcara="   " />);
    expect(container.textContent).toBe("");
  });
});

/* ==========================================================================
   LIMA HALAMAN YANG DIMINTA MENAMPILKAN TANGGAL ACARA

   Invoice, Quotation, Payment, laporan Penjualan, dan kartu Piutang.

   Diperiksa dari sumbernya, bukan dengan menggambar halamannya: kelimanya
   halaman server yang membaca database. Yang dijaga di sini satu hal yang
   mudah hilang tanpa ada galat — satu halaman dirapikan, empat lainnya
   tertinggal, dan tidak ada yang menegur.
   ========================================================================== */

const HALAMAN = [
  "app/(aplikasi)/tagihan/page.tsx",
  "app/(aplikasi)/penawaran/page.tsx",
  "app/(aplikasi)/pembayaran/page.tsx",
  "app/(aplikasi)/laporan/penjualan/page.tsx",
  "app/(aplikasi)/laporan/piutang/page.tsx",
];

describe("tanggal acara di daftar dan laporan", () => {
  it("kelima halamannya meringkasnya dengan perangkum yang sama", () => {
    for (const p of HALAMAN) {
      const isi = readFileSync(p, "utf8");
      expect(isi, `${p} tidak menampilkan tanggal acara`).toContain(
        "ringkasTanggalAcaraPendek",
      );
    }
  });

  it("tidak ada yang memakai bentuk PANJANGNYA di kolom tabel", () => {
    // Bentuk panjangnya — "Minggu 10 – Selasa 12 Mei 2026" — membungkus
    // menjadi tiga baris di kolom tabel dan membuat daftarnya tiga kali
    // lebih tinggi. Itu persis alasan bentuk pendeknya dibuat.
    for (const p of HALAMAN) {
      const isi = readFileSync(p, "utf8");
      expect(isi, `${p} memakai bentuk panjangnya`).not.toMatch(
        /ringkasTanggalAcara\(/,
      );
    }
  });

  it("tidak ada sel tanggal yang boleh patah", () => {
    // "20 Okt 2026" di kolom sempit terbelah menjadi tiga baris, dan
    // barisnya jadi tiga kali lebih tinggi.
    for (const p of HALAMAN) {
      const isi = readFileSync(p, "utf8");

      for (const [, kelas] of isi.matchAll(
        /<Td className="([^"]*)">\s*\n\s*\{format\(/g,
      )) {
        expect(kelas, `${p}: sel tanggal tanpa whitespace-nowrap`).toContain(
          "whitespace-nowrap",
        );
      }
    }
  });
});
