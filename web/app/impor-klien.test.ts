import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* ==========================================================================
   HALAMAN SERVER TIDAK BOLEH MEMANGGIL FUNGSI DARI MODUL KLIEN

   Di App Router, setiap ekspor modul bertanda "use client" berubah menjadi
   RUJUKAN ketika dibaca dari server — bukan fungsi yang sesungguhnya.
   Memanggilnya di halaman server melempar galat SAAT DIJALANKAN.

   Kelas kesalahan ini TIDAK TERLIHAT oleh alat mana pun yang sudah ada:
   tipenya sama persis sehingga `tsc` lolos, dan `next build` juga lolos
   karena halamannya tidak pernah benar-benar dijalankan saat membangun.

   Sudah terjadi: tiga halaman memanggil tanggalKosong() dari
   components/form-dokumen.tsx, dan ketiganya berhenti dengan "A server error
   occurred" di produksi sampai pemiliknya melaporkannya.

   Mengimpor TIPE dari modul klien tetap boleh — tipe hilang saat dibangun,
   jadi tidak ada yang dipanggil.
   ========================================================================== */

const AKAR = path.resolve(__dirname, "..");

function berkasSumber(dari: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dari)) {
    if (nama === "node_modules" || nama === ".next" || nama.startsWith(".")) continue;
    const penuh = path.join(dari, nama);
    if (statSync(penuh).isDirectory()) hasil.push(...berkasSumber(penuh));
    else if (/\.tsx?$/.test(nama) && !/\.test\.tsx?$/.test(nama)) hasil.push(penuh);
  }
  return hasil;
}

const SUMBER = [
  ...berkasSumber(path.join(AKAR, "app")),
  ...berkasSumber(path.join(AKAR, "components")),
  ...berkasSumber(path.join(AKAR, "lib")),
];

const isi = new Map(SUMBER.map((p) => [p, readFileSync(p, "utf8")]));

/** Modul klien dikenali dari baris "use client" di beberapa baris pertama. */
const MODUL_KLIEN = new Set(
  SUMBER.filter((p) => /^\s*["']use client["']/m.test(isi.get(p)!.slice(0, 200))),
);

/** Menyelesaikan "@/lib/x" atau "./x" menjadi berkas yang sebenarnya. */
function tujuan(dariBerkas: string, spesifikasi: string): string | null {
  let dasar: string;
  if (spesifikasi.startsWith("@/")) dasar = path.join(AKAR, spesifikasi.slice(2));
  else if (spesifikasi.startsWith(".")) dasar = path.resolve(path.dirname(dariBerkas), spesifikasi);
  else return null;

  for (const akhiran of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const coba = dasar + akhiran;
    if (isi.has(coba)) return coba;
  }
  return null;
}

describe("impor dari modul klien", () => {
  it("menemukan modul kliennya, supaya pemeriksaan ini tidak kosong", () => {
    // Pemeriksaan yang tidak menemukan apa pun akan selalu lolos, termasuk
    // ketika cara mengenali modul klien suatu saat berubah.
    expect(MODUL_KLIEN.size).toBeGreaterThan(3);
    expect(SUMBER.length).toBeGreaterThan(40);
  });

  it("tidak ada berkas server yang MEMANGGIL ekspor modul klien", () => {
    // MENGIMPOR komponen klien justru cara yang benar — begitulah komponen
    // klien digambar oleh halaman server, dan ia hanya dipakai sebagai <Tag>.
    // Yang merusak hanyalah MEMANGGILNYA sebagai fungsi.
    const pelanggaran: string[] = [];

    for (const berkas of SUMBER) {
      if (MODUL_KLIEN.has(berkas)) continue; // Klien ke klien tidak apa-apa.

      const teks = isi.get(berkas)!;
      const impor = teks.matchAll(/^import\s+(\{[^}]*\})\s+from\s+["']([^"']+)["'];/gm);

      for (const [, bagian, spesifikasi] of impor) {
        const asal = tujuan(berkas, spesifikasi);
        if (!asal || !MODUL_KLIEN.has(asal)) continue;

        for (const butir of bagian.replace(/^\{|\}$/g, "").split(",")) {
          const nama = butir.trim();
          // Tipe hilang saat dibangun, jadi tidak ada yang bisa dipanggil.
          if (nama === "" || nama.startsWith("type ")) continue;

          const pengenal = nama.split(/\s+as\s+/).pop()!.trim();
          const dipanggil = new RegExp(`(?<![.\\w])${pengenal}\\s*\\(`).test(teks);

          if (dipanggil) {
            pelanggaran.push(
              `${path.relative(AKAR, berkas)} memanggil ${pengenal}() dari ${spesifikasi}`,
            );
          }
        }
      }
    }

    expect(
      pelanggaran,
      "Berkas server memanggil ekspor modul klien. Di server, ekspor modul " +
        "klien hanyalah rujukan — memanggilnya melempar galat saat dijalankan. " +
        "Pindahkan pembantunya ke modul netral seperti lib/bentuk-form.ts.\n" +
        pelanggaran.join("\n"),
    ).toEqual([]);
  });
});
