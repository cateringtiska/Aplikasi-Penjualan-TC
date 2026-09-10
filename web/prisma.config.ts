import "dotenv/config";

import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Konfigurasi Prisma 7.
//
// Mulai versi 7, URL koneksi database tidak lagi ditulis di schema.prisma —
// tempatnya di sini. Berkas ini hanya dipakai oleh perintah baris perintah
// (`prisma db pull`, `prisma generate`, `prisma migrate`), bukan oleh aplikasi
// yang sedang berjalan. Aplikasi menyambung lewat lib/prisma.ts.

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  datasource: {
    url: env("DATABASE_URL"),
  },
});
