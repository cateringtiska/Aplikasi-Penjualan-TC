import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { NAVY } from "./warna-dokumen";

/* ==========================================================================
   SATU ATURAN WARNA UNTUK TIGA LEMBAR

   Quotation, invoice, dan PO To Kitchen keluar dari satu pesanan yang sama
   dan sering dibaca berdampingan. Kode warna yang tersalin di masing-masing
   lembar menyimpang diam-diam: satu lembar dirapikan, dua lainnya
   tertinggal, dan tidak ada galat apa pun.

   Itu sudah terjadi di aplikasi ini berkali-kali — pada komponen panel,
   pada kepala tabel, dan terakhir pada warna lembar dapur sendiri.
   ========================================================================== */

const LEMBAR = ["components/dokumen-cetak.tsx", "components/dokumen-dapur.tsx"];

describe("warna dokumen cetak", () => {
  it("navy-nya navy sungguhan, bukan biru lain yang mendekati", () => {
    expect(NAVY.toLowerCase()).toBe("#000080");
  });

  it("tidak ada lembar yang menuliskan kode navy-nya sendiri", () => {
    for (const p of LEMBAR) {
      const isi = readFileSync(p, "utf8");

      expect(isi, `${p} menyalin kode navy-nya`).not.toContain(NAVY);
      expect(isi, `${p} tidak memakai warna bersamanya`).toContain(
        'from "@/lib/warna-dokumen"',
      );
    }
  });

  it("isi paket tidak diberi warna abu-abu lagi di lembar mana pun", () => {
    // Isi paket harus HITAM di ketiganya. Abu-abu tipis membuatnya hilang
    // di atas kertas, padahal itu yang dibaca baris demi baris.
    for (const p of LEMBAR) {
      const isi = readFileSync(p, "utf8");

      for (const [baris] of isi.matchAll(/^.*\{r\.nama\}.*$/gm)) {
        expect(baris, `${p}: isi paketnya masih diberi warna`).not.toMatch(
          /text-\[#[0-9a-fA-F]{3,6}\]/,
        );
      }
    }
  });
});
