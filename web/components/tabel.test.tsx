import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { KepalaTabel, Th } from "./tabel";

/** Tabel LAYAR. Tabel cetak punya gaya sendiri dan tidak ikut aturan ini. */
function tabelLayar(): string[] {
  const hasil: string[] = [];

  // Ditelusuri dengan Node, bukan grep: pengujian ini juga dijalankan dari
  // Windows, dan di sana grep tidak ada — pagarnya akan "gagal" karena
  // perkakasnya hilang, bukan karena ada yang salah.
  const telusuri = (dir: string) => {
    for (const isi of readdirSync(dir, { withFileTypes: true })) {
      const jalur = join(dir, isi.name);
      if (isi.isDirectory()) {
        if (isi.name !== "node_modules") telusuri(jalur);
      } else if (isi.name.endsWith(".tsx")) {
        hasil.push(jalur.split("\\").join("/"));
      }
    }
  };

  telusuri("app/(aplikasi)");
  telusuri("components");

  return hasil.filter(
    (b) =>
      !b.endsWith("components/tabel.tsx") &&
      !b.endsWith("components/tabel.test.tsx") &&
      !b.includes("dokumen-cetak") &&
      !b.includes("dokumen-dapur"),
  );
}

describe("kepala tabel bersama", () => {
  it("menyusun thead dan baris kepalanya sendiri", () => {
    render(
      <table>
        <KepalaTabel>
          <Th>Nomor</Th>
          <Th className="text-right">Nilai</Th>
        </KepalaTabel>
      </table>,
    );

    expect(screen.getByRole("columnheader", { name: "Nomor" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Nilai" }).className).toContain(
      "text-right",
    );
  });

  it("menerima Th tanpa isi, untuk kolom tombol", () => {
    render(
      <table>
        <KepalaTabel>
          <Th className="w-12" />
        </KepalaTabel>
      </table>,
    );

    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
  });

  // Kepala ini dulu TERSALIN apa adanya di enam belas berkas, dan sudah
  // sempat menyimpang: dua halaman dirapikan, empat belas lainnya
  // tertinggal pucat. Tidak ada galat apa pun yang menandainya.
  it("tidak ada halaman yang menyusun kepala tabelnya sendiri lagi", () => {
    const berkas = tabelLayar();
    expect(berkas.length).toBeGreaterThan(10);

    for (const b of berkas) {
      const isi = readFileSync(b, "utf8");

      expect(isi, `${b} membuat Th sendiri`).not.toMatch(/^function Th\(/m);
      expect(isi, `${b} menyusun baris kepalanya sendiri`).not.toMatch(/<thead>/);
    }
  });
});
