import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const akar = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": akar,
      // "server-only" sengaja melempar galat kalau diimpor di luar konteks
      // server. Di dalam tes ia diarahkan ke modul kosong supaya berkas yang
      // memakainya tetap bisa diuji.
      "server-only": path.join(akar, "vitest.server-only.ts"),
    },
  },

  test: {
    // Dua jenis tes berjalan di sini:
    //
    //   lib/**        perhitungan murni — cepat, tanpa DOM, tanpa database
    //   components/** membuka menu dan dialog di dalam DOM tiruan
    //
    // Yang kedua ada karena tiga bug beruntun pernah lolos ke produksi lewat
    // komponen yang hanya gagal saat diklik: TypeScript bersih, build bersih,
    // log server kosong. Menggambar halaman saja tidak cukup — isi menu tidak
    // dirender sama sekali sebelum menunya dibuka.
    //
    // Tes alur ujung ke ujung ada di scripts/ dan dijalankan terpisah lewat
    // `npm run uji:alur`, karena ia benar-benar menulis ke database.
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
    ],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
