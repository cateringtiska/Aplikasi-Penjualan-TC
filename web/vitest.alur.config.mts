import { defineConfig } from "vitest/config";

/**
 * Konfigurasi khusus tes alur ujung ke ujung.
 *
 * Dipisah dari konfigurasi utama karena tes ini benar-benar menulis ke
 * database, jadi tidak boleh ikut berjalan pada `npm test` yang dipakai
 * sehari-hari. Dijalankan lewat `npm run uji:alur`.
 */
export default defineConfig({
  test: {
    include: ["scripts/alur.test.ts"],
    // Vitest tidak memuat .env sendiri; tanpa ini DATABASE_URL kosong.
    setupFiles: ["dotenv/config"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Berbagi satu koneksi database, dan urutan langkahnya memang harus runut.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
