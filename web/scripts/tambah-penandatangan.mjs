/**
 * Menambahkan daftar penandatangan, dan pilihan penandatangan per dokumen.
 *
 * Marketing ada dua orang, dan dokumen ditandatangani salah satunya. Satu
 * kolom nama di pengaturan perusahaan tidak bisa menyatakan itu.
 *
 * PENANDATANGAN TIDAK PERNAH DIHAPUS, hanya dinonaktifkan. Dokumen yang
 * sudah terbit menunjuk ke barisnya; menghapusnya akan membuat dokumen lama
 * kehilangan tanda tangannya — dan dokumen yang sudah dikirim ke customer
 * tidak boleh berubah karena orangnya pindah kerja.
 *
 * Disemai dari penandatangan yang sekarang, jadi dokumen yang sudah ada
 * tetap tercetak sama persis.
 *
 * Dijalankan sekali: node scripts/tambah-penandatangan.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

for (const baris of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const url = (process.env.DIRECT_DATABASE_URL ?? "")
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?&]uselibpqcompat=[^&]*/g, "");

const klien = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await klien.connect();

await klien.query(`
  CREATE TABLE IF NOT EXISTS signatories (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    signature_path VARCHAR(255),
    is_active      BOOLEAN NOT NULL DEFAULT true,
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMP(0),
    updated_at     TIMESTAMP(0)
  )
`);

await klien.query(`ALTER TABLE signatories ENABLE ROW LEVEL SECURITY`);
await klien.query(`REVOKE ALL ON signatories FROM anon, authenticated`);
await klien.query(`REVOKE ALL ON SEQUENCE signatories_id_seq FROM anon, authenticated`);

// ON DELETE SET NULL hanya jaring pengaman: barisnya memang tidak pernah
// dihapus, tetapi kalau suatu saat terhapus, dokumennya tidak ikut hilang.
for (const [tabel, nama] of [["quotations", "quotations"], ["invoices", "invoices"]]) {
  await klien.query(`ALTER TABLE ${tabel} ADD COLUMN IF NOT EXISTS signatory_id BIGINT`);
  await klien.query(`
    DO $$ BEGIN
      ALTER TABLE ${tabel}
        ADD CONSTRAINT ${nama}_signatory_id_foreign
        FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
}

/* ---------- Semai dari penandatangan yang sekarang ---------- */

const { rows: perusahaan } = await klien.query(
  `SELECT signature_name, signature_path FROM company_settings WHERE id = 1`,
);
const sekarang = perusahaan[0];

const { rows: sudahAda } = await klien.query(`SELECT count(*) AS n FROM signatories`);

if (Number(sudahAda[0].n) === 0 && sekarang?.signature_name) {
  await klien.query(
    `INSERT INTO signatories (name, signature_path, is_active, sort_order, created_at, updated_at)
     VALUES ($1, $2, true, 0, now(), now())`,
    [sekarang.signature_name, sekarang.signature_path],
  );
  console.log(`Disemai: ${sekarang.signature_name}`);
} else {
  console.log(`Tidak disemai (sudah ada ${sudahAda[0].n} baris).`);
}

/* ---------- Dibaca ulang ---------- */

const { rows } = await klien.query(
  `SELECT id, name, signature_path, is_active FROM signatories ORDER BY sort_order, id`,
);
for (const r of rows) {
  console.log(`  #${r.id} ${r.name} · ttd=${r.signature_path ?? "-"} · aktif=${r.is_active}`);
}

const { rows: kolom } = await klien.query(
  `SELECT table_name, column_name FROM information_schema.columns
    WHERE column_name = 'signatory_id' ORDER BY table_name`,
);
console.log("kolom signatory_id:", kolom.map((k) => k.table_name).join(", "));

if (rows.length === 0) throw new Error("Tidak ada penandatangan tersemai.");
if (kolom.length !== 2) throw new Error("Kolom signatory_id belum lengkap.");

await klien.end();
console.log("selesai");
