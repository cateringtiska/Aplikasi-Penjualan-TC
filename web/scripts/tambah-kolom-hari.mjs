/**
 * Menambahkan kolom "day" pada baris item invoice dan quotation.
 *
 * Dokumen katering menghitung satu baris sebagai: HARI x JUMLAH x HARGA.
 * Acara tiga hari dengan 130 box per hari adalah 390 box, dan menuliskannya
 * sebagai satu baris berjumlah 390 menghilangkan keterangan bahwa yang
 * dipesan 130 per hari selama tiga hari.
 *
 * BAWAANNYA 1, jadi seluruh baris yang sudah ada tidak berubah nilainya:
 * 1 x jumlah x harga sama persis dengan jumlah x harga.
 *
 * Dijalankan sekali: node scripts/tambah-kolom-hari.mjs
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

/* ---------- Angka SEBELUM, untuk dibandingkan sesudahnya ---------- */

const { rows: sebelum } = await klien.query(
  `SELECT invoice_number, subtotal, grand_total FROM invoices ORDER BY id`,
);

for (const tabel of ["invoice_items", "quotation_items"]) {
  await klien.query(
    `ALTER TABLE ${tabel} ADD COLUMN IF NOT EXISTS day NUMERIC(15,2) NOT NULL DEFAULT 1`,
  );

  const { rows } = await klien.query(
    `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns WHERE table_name = $1 AND column_name = 'day'`,
    [tabel],
  );
  const k = rows[0];
  console.log(`${tabel}.day: ${k?.data_type} default=${k?.column_default} null=${k?.is_nullable}`);

  // Tidak boleh ada satu pun baris yang bawaannya meleset.
  const { rows: aneh } = await klien.query(`SELECT count(*) AS n FROM ${tabel} WHERE day <> 1`);
  console.log(`  baris dengan day bukan 1: ${aneh[0].n}`);
}

/* ---------- Angka SESUDAH harus sama persis ---------- */

const { rows: sesudah } = await klien.query(
  `SELECT invoice_number, subtotal, grand_total FROM invoices ORDER BY id`,
);

let beda = 0;
for (let i = 0; i < sebelum.length; i++) {
  const a = sebelum[i];
  const b = sesudah[i];
  if (a.subtotal !== b.subtotal || a.grand_total !== b.grand_total) {
    console.log(`BERUBAH ${a.invoice_number}: ${a.grand_total} -> ${b.grand_total}`);
    beda++;
  }
}
console.log(`${sebelum.length} invoice diperiksa, ${beda} berubah nilainya`);
if (beda > 0) throw new Error("Ada dokumen yang nilainya berubah. Jangan diteruskan.");

await klien.end();
console.log("selesai");
