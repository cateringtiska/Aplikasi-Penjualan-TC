/**
 * Menambahkan tabel biaya tambahan untuk invoice dan quotation.
 *
 * Baris-baris ini ditambahkan ke total TETAPI tidak pernah masuk dasar
 * service charge maupun PB1 — sama kedudukannya dengan delivery. Bedanya,
 * namanya bebas dan jumlahnya boleh lebih dari satu: "Tim Servis utk Menu
 * Buffet", "Tambahan Set-up & Layanan 1 Titik VIP Buffet", dan seterusnya.
 *
 * Dijalankan sekali: node scripts/tambah-biaya-tambahan.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

for (const baris of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

// Port 5432 (session pooler). DDL tidak boleh lewat transaction pooler.
//
// `sslmode` DIBUANG dari URL-nya, bukan diubah: driver pg memperlakukan
// `sslmode=require` sebagai `verify-full`, dan Supabase memakai CA sendiri —
// hasilnya "self-signed certificate in certificate chain". Setelah parameter
// itu hilang, opsi ssl di bawah inilah yang dipakai.
const url = (process.env.DIRECT_DATABASE_URL ?? "")
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?&]uselibpqcompat=[^&]*/g, "");

const klien = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await klien.connect();

for (const [tabel, induk, kolomInduk] of [
  ["invoice_charges", "invoices", "invoice_id"],
  ["quotation_charges", "quotations", "quotation_id"],
]) {
  await klien.query(`
    CREATE TABLE IF NOT EXISTS ${tabel} (
      id            BIGSERIAL PRIMARY KEY,
      ${kolomInduk} BIGINT NOT NULL,
      label         VARCHAR(255) NOT NULL,
      amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
      created_at    TIMESTAMP(0),
      updated_at    TIMESTAMP(0),
      CONSTRAINT ${tabel}_${kolomInduk}_foreign
        FOREIGN KEY (${kolomInduk}) REFERENCES ${induk}(id) ON DELETE CASCADE
    )
  `);

  await klien.query(
    `CREATE INDEX IF NOT EXISTS ${tabel}_${kolomInduk}_index ON ${tabel}(${kolomInduk})`,
  );

  // Menyamakan sikap dengan tabel lain: RLS menyala, hak anon dan
  // authenticated dicabut. Aplikasi menyambung sebagai peran postgres yang
  // melewati RLS, jadi pencabutan itu tidak mengganggu apa pun.
  await klien.query(`ALTER TABLE ${tabel} ENABLE ROW LEVEL SECURITY`);
  await klien.query(`REVOKE ALL ON ${tabel} FROM anon, authenticated`);
  await klien.query(`REVOKE ALL ON SEQUENCE ${tabel}_id_seq FROM anon, authenticated`);

  // Dibaca ulang dari katalog, bukan dianggap berhasil.
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
