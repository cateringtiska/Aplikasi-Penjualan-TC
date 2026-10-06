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

/* ==========================================================================
   MODUL KLIEN TIDAK BOLEH MENYENTUH MODUL "server-only"

   Arah sebaliknya, dan sama tidak terlihatnya. Modul bertanda
   `import "server-only"` melempar galat begitu ikut terbawa ke bundel
   browser. `tsc` lolos — tipenya memang ada — dan kegagalannya muncul
   sebagai build yang berhenti tanpa menyebut bahwa sebabnya hanya letak
   berkas.

   Hampir terjadi: layar pemilih peran mengambil daftar PERAN dari
   lib/auth.ts, yang memasang penjaga itu. Daftarnya lalu dipindah ke
   lib/peran.ts, yang murni.

   Diperiksa SAMPAI BERLAPIS: modul murni yang mengimpor modul server-only
   akan ikut menularkannya ke setiap komponen klien yang memakainya.

   Mengimpor TIPE tetap boleh — tipe hilang saat dibangun, jadi tidak ada
   apa pun yang terbawa.
   ========================================================================== */

/**
 * Berkas server action, dikenali dari baris "use server".
 *
 * Ia adalah BATAS: Next.js menggantikan ekspornya dengan pemanggilan jarak
 * jauh, jadi apa pun yang diimpornya tidak pernah ikut ke browser. Komponen
 * klien yang mengimpor server action memang cara yang benar, dan
 * penelusuran harus berhenti di sini — kalau tidak, seluruh tombol simpan
 * di aplikasi ini akan terbaca sebagai pelanggaran.
 */
const MODUL_AKSI = new Set(
  SUMBER.filter((p) => /^s*["']use server["']/m.test(isi.get(p)!.slice(0, 200))),
);

/** Modul yang memasang penjaga server-only. */
const MODUL_SERVER = new Set(
  SUMBER.filter((p) => /^\s*import\s+["']server-only["']/m.test(isi.get(p)!)),
);

/**
 * Modul yang diimpor sebagai NILAI, bukan hanya tipenya.
 *
 * `import type { X }` dan `{ type X }` dibuang: keduanya hilang saat
 * dibangun, jadi tidak menularkan apa pun.
 */
function imporNilai(berkas: string): string[] {
  const teks = isi.get(berkas)!;
  const hasil: string[] = [];

  for (const [, klausa, spesifikasi] of teks.matchAll(
    /^import\s+(?!type[\s{])([\s\S]*?)\s+from\s+["']([^"']+)["'];/gm,
  )) {
    // Klausa yang seluruh isinya bertanda `type` tidak membawa nilai apa pun.
    const kurung = klausa.match(/^\{([\s\S]*)\}$/);
    if (kurung) {
      const adaNilai = kurung[1]
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b !== "")
        .some((b) => !b.startsWith("type "));
      if (!adaNilai) continue;
    }

    const asal = tujuan(berkas, spesifikasi);
    if (asal) hasil.push(asal);
  }

  return hasil;
}

/** Jalur impor dari satu modul sampai modul server-only, kalau ada. */
function jalurKeServer(mulai: string): string[] | null {
  const antre: string[][] = [[mulai]];
  const sudah = new Set([mulai]);

  while (antre.length > 0) {
    const jalur = antre.shift()!;
    const kini = jalur[jalur.length - 1];

    // Penelusuran tidak masuk ke dalam server action: lihat MODUL_AKSI.
    if (kini !== mulai && MODUL_AKSI.has(kini)) continue;

    for (const berikut of imporNilai(kini)) {
      if (sudah.has(berikut)) continue;
      sudah.add(berikut);

      const jalurBaru = [...jalur, berikut];
      if (MODUL_SERVER.has(berikut)) return jalurBaru;
      antre.push(jalurBaru);
    }
  }

  return null;
}

describe("impor ke modul server-only", () => {
  it("menemukan modul server-only-nya, supaya pemeriksaan ini tidak kosong", () => {
    expect(MODUL_SERVER.size).toBeGreaterThan(3);
    expect(MODUL_AKSI.size, "batas server action tidak ditemukan").toBeGreaterThan(3);
  });

  it("MASIH menyalakan tanda, berlapis maupun tidak", () => {
    // Pemeriksaan yang terlalu longgar akan lolos apa saja, dan batas server
    // action di atas justru melonggarkannya. Dua hal dibuktikan dengan
    // berkas yang sungguhan ada.
    const rbac = path.join(AKAR, "lib", "rbac.ts");
    const auth = path.join(AKAR, "lib", "auth.ts");
    const peran = path.join(AKAR, "lib", "peran.ts");
    const dialogPeran = path.join(AKAR, "app", "(aplikasi)", "pengguna", "dialog-pengguna.tsx");

    expect(MODUL_SERVER.has(auth), "lib/auth.ts tidak lagi server-only").toBe(true);

    // 1. Penelusuran berlapis benar-benar berjalan: rbac tidak memasang
    //    penjaganya sendiri di baris pertama, tetapi ia menarik auth.
    expect(jalurKeServer(rbac), "jalur berlapis tidak terbaca").toEqual([rbac, auth]);

    // 2. Modul murni tetap murni, dan layar pemilih peran memakainya —
    //    inilah yang dulu hampir salah.
    expect(imporNilai(dialogPeran), "dialog peran tidak lagi memakai lib/peran.ts").toContain(
      peran,
    );
    expect(jalurKeServer(peran), "lib/peran.ts ikut menarik modul server").toBeNull();
  });

  it("tidak ada modul klien yang menariknya, langsung maupun berlapis", () => {
    const pelanggaran: string[] = [];

    for (const berkas of MODUL_KLIEN) {
      const jalur = jalurKeServer(berkas);
      if (jalur) {
        pelanggaran.push(jalur.map((p) => path.relative(AKAR, p)).join(" → "));
      }
    }

    expect(
      pelanggaran,
      'Modul klien menarik modul bertanda `import "server-only"`, dan itu ' +
        "menggagalkan build tanpa menyebut sebabnya. Pindahkan bagian yang " +
        "dibutuhkan keduanya ke modul murni, seperti lib/peran.ts.\n" +
        pelanggaran.join("\n"),
    ).toEqual([]);
  });
});
