/**
 * Menambahkan tabel tanggal acara untuk invoice dan quotation.
 *
 * Satu dokumen bisa menanggung acara 1-4 hari, dan tanggalnya tidak selalu
 * berurutan — 10, 12, lalu 15 Mei. Satu kolom tanggal ditambah satu kolom
 * "jumlah hari" tidak bisa menyatakan itu: yang tercetak hanya tanggal
 * pertamanya, dan pembaca dokumen harus menebak sisanya.
 *
 * Kolom `event_date` TETAP ADA dan diisi tanggal paling awal. Ia dipakai
 * daftar quotation, dan membiarkannya berarti tidak ada satu pun tempat lain
 * yang perlu ikut berubah.
 *
 * Dijalankan sekali: node scripts/tambah-tanggal-acara.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

for (const baris of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

// sslmode dibuang dari URL-nya: driver pg memperlakukannya sebagai
// verify-full, dan Supabase memakai CA sendiri. Lihat catatan di
// scripts/tambah-biaya-tambahan.mjs.
const url = (process.env.DIRECT_DATABASE_URL ?? "")
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?&]uselibpqcompat=[^&]*/g, "");

const klien = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await klien.connect();

for (const [tabel, induk, kolomInduk] of [
  ["invoice_event_dates", "invoices", "invoice_id"],
  ["quotation_event_dates", "quotations", "quotation_id"],
]) {
  await klien.query(`
    CREATE TABLE IF NOT EXISTS ${tabel} (
      id            BIGSERIAL PRIMARY KEY,
      ${kolomInduk} BIGINT NOT NULL,
      event_date    DATE NOT NULL,
      created_at    TIMESTAMP(0),
      updated_at    TIMESTAMP(0),
      CONSTRAINT ${tabel}_${kolomInduk}_foreign
        FOREIGN KEY (${kolomInduk}) REFERENCES ${induk}(id) ON DELETE CASCADE
    )
  `);

  // Satu tanggal hanya boleh muncul sekali dalam satu dokumen. Tanggal
  // kembar akan menghitung jumlah hari lebih banyak daripada yang terjadi.
  await klien.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${tabel}_${kolomInduk}_event_date_unique
       ON ${tabel}(${kolomInduk}, event_date)`,
  );

  await klien.query(`ALTER TABLE ${tabel} ENABLE ROW LEVEL SECURITY`);
  await klien.query(`REVOKE ALL ON ${tabel} FROM anon, authenticated`);
  await klien.query(`REVOKE ALL ON SEQUENCE ${tabel}_id_seq FROM anon, authenticated`);

  const { rows } = await klien.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 ORDER BY ordinal_position`,
    [tabel],
  );
  const { rows: rls } = await klien.query(
    `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
    [tabel],
  );
  console.log(`${tabel}: ${rows.map((r) => r.column_name).join(", ")} | RLS=${rls[0]?.relrowsecurity}`);
}

await klien.end();
console.log("selesai");
