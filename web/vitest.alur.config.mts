import { defineConfig } from "vitest/config";

/**
 * Konfigurasi khusus tes alur ujung ke ujung.
 *
 * Dipisah dari konfigurasi utama karena tes ini benar-benar menulis ke
 * database, jadi tidak boleh ikut berjalan pada `npm test` yang dipakai
 * sehari-hari. Dijalankan lewat `npm run uji:alur`.
 */
export default defineConfig({
  resolve: {
    // lib/nomor.ts memasang penjaga "server-only" supaya tidak pernah
    // terbawa ke browser. Di luar Next.js penjaga itu selalu melempar galat,
    // jadi di sini diganti modul kosong.
    alias: {
      "server-only": new URL("vitest.server-only.ts", import.meta.url).pathname,
      // Rute unduhan memakai jalur "@/..."; tanpa ini modulnya tidak ketemu.
      "@": new URL(".", import.meta.url).pathname.replace(/\/$/, ""),
    },
  },
  test: {
    include: [
      "scripts/alur.test.ts",
      "scripts/nomor-dalam-transaksi.test.ts",
      "scripts/biaya-penawaran.test.ts",
      "scripts/ekspor-excel.test.ts",
      "scripts/kartu-piutang.test.ts",
      "scripts/piutang-lunas.test.ts",
      "scripts/jatuh-tempo.test.ts",
      "scripts/kategori-biaya.test.ts",
    ],
    // Vitest tidak memuat .env sendiri; tanpa ini DATABASE_URL kosong.
    setupFiles: ["dotenv/config"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Berbagi satu koneksi database, dan urutan langkahnya memang harus runut.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
