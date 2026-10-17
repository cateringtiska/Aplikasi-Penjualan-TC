import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { KotakRincian } from "./kotak-rincian";

const HALAMAN = [
  "app/(aplikasi)/penawaran/[id]/page.tsx",
  "app/(aplikasi)/tagihan/[id]/page.tsx",
];

describe("KotakRincian", () => {
  it("judulnya menjadi kepala yang bisa ditemukan sebagai judul, bukan teks biasa", () => {
    render(
      <KotakRincian judul="Syarat pembayaran">
        <p>Pelunasan H-3 sebelum acara.</p>
      </KotakRincian>,
    );

    expect(screen.getByRole("heading", { name: "Syarat pembayaran" })).toBeTruthy();
    expect(screen.getByText("Pelunasan H-3 sebelum acara.")).toBeTruthy();
  });

  // className-nya dipakai untuk jarak antar panel (mt-6). Prop yang diterima
  // lalu tidak diteruskan tidak memunculkan galat apa pun — panelnya hanya
  // menempel ke panel di atasnya.
  it("meneruskan className yang diberikan", () => {
    const { container } = render(
      <KotakRincian judul="Catatan" className="mt-6">
        <p>Tanpa babi.</p>
      </KotakRincian>,
    );

    expect(container.querySelector("section")?.className).toContain("mt-6");
  });

  // Komponen ini dulu TERSALIN apa adanya di kedua halaman detail. Salinan
  // seperti itu menyimpang diam-diam: satu halaman dirapikan, yang lain
  // tertinggal, dan tidak ada galat apa pun.
  it("tidak ada halaman detail yang membuat panelnya sendiri lagi", () => {
    for (const halaman of HALAMAN) {
      const isi = readFileSync(halaman, "utf8");

      expect(isi, `${halaman} membuat panel sendiri`).not.toMatch(/function Kotak\w*\(/);
      expect(isi, `${halaman} tidak memakai panel bersamanya`).toContain(
        'from "@/components/kotak-rincian"',
      );
    }
  });
});
