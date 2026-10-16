import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LogoSudut } from "./latar-merek";

/* ==========================================================================
   LOGO DI SUDUT TIDAK BOLEH MENGHALANGI TOMBOL

   Sudut kanan atas adalah tempat tombol "Buat invoice" dan "Buat quotation"
   berada. Logo yang digambar di atasnya akan membuat tombol itu tidak bisa
   ditekan — TANPA GALAT APA PUN, hanya tombol yang tiba-tiba tidak
   menanggapi, dan tidak ada apa pun di layar yang menjelaskan kenapa.

   Hiasan yang memakan fungsi lebih buruk daripada tidak ada hiasan.
   ========================================================================== */

afterEach(cleanup);

const TAUTAN = "https://contoh.invalid/logo.png";

describe("logo sudut", () => {
  it("tidak menangkap klik sama sekali", () => {
    const { container } = render(<LogoSudut tautan={TAUTAN} />);

    // alt kosong membuatnya TIDAK berperan "img", dan itu memang benar
    // untuk hiasan — jadi dicari lewat tagnya.
    const wadah = container.querySelector("img")?.parentElement;
    expect(wadah, "logonya tidak digambar sama sekali").toBeTruthy();
    expect(wadah?.className, "logo menangkap klik").toContain("pointer-events-none");
  });

  it("berada DI BELAKANG isi halaman", () => {
    // z-0 di sini, sementara sidebar dan isi halaman z-10. Tanpa itu,
    // urutannya ditentukan urutan penulisan di berkas — yang bisa berubah
    // tanpa ada yang menyadari akibatnya.
    const { container } = render(<LogoSudut tautan={TAUTAN} />);

    // alt kosong membuatnya TIDAK berperan "img", dan itu memang benar
    // untuk hiasan — jadi dicari lewat tagnya.
    const wadah = container.querySelector("img")?.parentElement;
    expect(wadah, "logonya tidak digambar sama sekali").toBeTruthy();
    expect(wadah?.className).toContain("z-0");
  });

  it("tidak ikut tercetak", () => {
    // Dokumen cetak punya kop logonya sendiri; yang ini hiasan layar.
    const { container } = render(<LogoSudut tautan={TAUTAN} />);

    // alt kosong membuatnya TIDAK berperan "img", dan itu memang benar
    // untuk hiasan — jadi dicari lewat tagnya.
    const wadah = container.querySelector("img")?.parentElement;
    expect(wadah, "logonya tidak digambar sama sekali").toBeTruthy();
    expect(wadah?.className).toContain("print:hidden");
  });

  it("tidak menggambar apa pun kalau logonya belum diunggah", () => {
    // Perusahaan yang belum mengunggah logo tidak boleh mendapat kotak
    // gambar rusak di sudut setiap halaman.
    const { container } = render(<LogoSudut tautan={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("disembunyikan dari pembaca layar", () => {
    // Ia hiasan. Diumumkan sebagai gambar, ia menyela setiap halaman
    // dengan sesuatu yang tidak menambah keterangan apa pun.
    const { container } = render(<LogoSudut tautan={TAUTAN} />);

    // alt kosong membuatnya TIDAK berperan "img", dan itu memang benar
    // untuk hiasan — jadi dicari lewat tagnya.
    const wadah = container.querySelector("img")?.parentElement;
    expect(wadah, "logonya tidak digambar sama sekali").toBeTruthy();
    expect(wadah?.getAttribute("aria-hidden")).toBe("true");
  });
});
