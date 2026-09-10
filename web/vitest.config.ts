import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tes bawaan hanya yang murni perhitungan — cepat dan tidak menyentuh
    // database, jadi aman dijalankan sesering mungkin.
    //
    // Tes alur ujung ke ujung ada di scripts/ dan dijalankan terpisah lewat
    // `npm run uji:alur`, karena ia benar-benar menulis ke database.
    include: ["lib/**/*.test.ts"],
  },
});
