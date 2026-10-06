/**
 * Menambahkan tabel hak akses per peran.
 *
 * Sebelum ini, hak akses tertulis di lib/navigasi.ts dan hanya bisa diubah
 * oleh saya. Pemiliknya ingin mengaturnya sendiri.
 *
 * DISEMAI DARI ATURAN YANG BERLAKU SEKARANG, jadi tidak ada satu pun yang
 * berubah di hari pertama. Tabel kosong akan berarti "tidak ada yang boleh
 * membuka apa pun", dan satu-satunya yang menyadarinya adalah orang yang
 * mendadak tidak bisa bekerja.
 *
 * Dijalankan sekali: node scripts/tambah-izin-peran.mjs
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
  CREATE TABLE IF NOT EXISTS role_permissions (
    id         BIGSERIAL PRIMARY KEY,
    role       VARCHAR(255) NOT NULL,
    menu_key   VARCHAR(255) NOT NULL,
    allowed    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(0),
    updated_at TIMESTAMP(0),
    CONSTRAINT role_permissions_role_menu_unique UNIQUE (role, menu_key)
  )
`);

await klien.query(`ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY`);
await klien.query(`REVOKE ALL ON role_permissions FROM anon, authenticated`);
await klien.query(`REVOKE ALL ON SEQUENCE role_permissions_id_seq FROM anon, authenticated`);

/* ---------- Semai dari aturan yang berlaku sekarang ---------- */

const SEMAI = {
  dasbor: ["sales", "finance"],
  penawaran: ["sales", "finance"],
  tagihan: ["sales", "finance"],
  pembayaran: ["finance"],
  "laporan-penjualan": ["sales", "finance"],
  "laporan-piutang": ["sales", "finance"],
  "laporan-margin": ["finance"],
  pelanggan: ["sales", "finance"],
  produk: ["sales", "finance"],
};

for (const [kunci, peran] of Object.entries(SEMAI)) {
  for (const p of ["sales", "finance"]) {
    await klien.query(
      `INSERT INTO role_permissions (role, menu_key, allowed, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (role, menu_key) DO NOTHING`,
      [p, kunci, peran.includes(p)],
    );
  }
}

/* ---------- Dibaca ulang, bukan dianggap berhasil ---------- */

const { rows } = await klien.query(
  `SELECT role, menu_key, allowed FROM role_permissions ORDER BY menu_key, role`,
);

let meleset = 0;
for (const r of rows) {
  const harusnya = (SEMAI[r.menu_key] ?? []).includes(r.role);
  if (r.allowed !== harusnya) {
    console.log(`MELESET ${r.role}/${r.menu_key}: ${r.allowed} seharusnya ${harusnya}`);
    meleset++;
  }
}

console.log(`${rows.length} baris izin tersimpan, ${meleset} meleset`);
console.log(
  rows
    .filter((r) => r.allowed)
    .map((r) => `${r.role}:${r.menu_key}`)
    .join(", "),
);

// Pengaturan TIDAK disemai: User dan Company tetap milik admin saja.
const { rows: pengaturan } = await klien.query(
  `SELECT count(*) AS n FROM role_permissions WHERE menu_key IN ('pengguna', 'perusahaan')`,
);
console.log(`baris untuk halaman pengaturan: ${pengaturan[0].n} (harus 0)`);
if (Number(pengaturan[0].n) > 0) throw new Error("Halaman pengaturan tidak boleh ada di tabel izin.");
if (meleset > 0) throw new Error("Ada izin yang tidak sesuai aturan yang berlaku sekarang.");

await klien.end();
console.log("selesai");
