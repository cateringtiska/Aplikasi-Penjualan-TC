import "dotenv/config";

import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Konfigurasi Prisma 7 — hanya dipakai perintah baris perintah
// (`prisma db pull`, `prisma generate`, `prisma migrate`), bukan oleh
// aplikasi yang sedang berjalan. Aplikasi menyambung lewat lib/prisma.ts.
//
// PENTING: perintah CLI memakai DIRECT_DATABASE_URL, yaitu pooler SESSION
// MODE di port 5432. Aplikasi memakai DATABASE_URL, yaitu pooler TRANSACTION
// MODE di port 6543.
//
// Bedanya penting: migrasi dan introspeksi butuh satu koneksi yang bertahan
// selama beberapa perintah berurutan, dan itu hanya dijamin session mode.
// Sebaliknya aplikasi serverless butuh transaction mode supaya jatah koneksi
// tidak habis. Kalau DIRECT_DATABASE_URL tidak diisi, dipakai DATABASE_URL —
// biasanya tetap jalan, tetapi migrasi besar bisa gagal di tengah.

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  datasource: {
    url: env("DIRECT_DATABASE_URL") ?? env("DATABASE_URL"),
  },
});
