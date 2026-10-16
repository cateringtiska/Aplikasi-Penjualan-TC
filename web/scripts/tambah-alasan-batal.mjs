/**
 * Menambah catatan pembatalan pada invoice dan quotation.
 *
 * Dokumen yang dibatalkan tetap ada di daftar dan tetap terhitung di
 * laporan sebagai "dibatalkan", tetapi tidak ada satu pun keterangan
 * KENAPA. Beberapa minggu kemudian tidak seorang pun bisa menjawabnya —
 * apakah customer membatalkan, apakah salah terbit, atau apakah
 * digantikan dokumen lain.
 *
 * Tiga kolom, bukan satu. Alasannya saja tidak cukup:
 *
 *   cancel_reason  kenapa dibatalkan
 *   cancelled_at   kapan — updated_at ikut berubah setiap kali dokumennya
 *                  disentuh, jadi ia tidak bisa menjawab ini
 *   cancelled_by   siapa yang memutuskan
 */
import "dotenv/config";
import pg from "pg";

const url = new URL(process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
url.searchParams.delete("uselibpqcompat");

const klien = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
});
await klien.connect();

for (const tabel of ["invoices", "quotations"]) {
  await klien.query(`ALTER TABLE ${tabel} ADD COLUMN IF NOT EXISTS cancel_reason TEXT`);
  await klien.query(`ALTER TABLE ${tabel} ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP(0)`);
  await klien.query(`ALTER TABLE ${tabel} ADD COLUMN IF NOT EXISTS cancelled_by BIGINT`);

  const nama = `${tabel}_cancelled_by_foreign`;
  const { rows: ada } = await klien.query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1`,
    [nama],
  );
  if (ada.length === 0) {
    await klien.query(
      `ALTER TABLE ${tabel}
         ADD CONSTRAINT ${nama}
         FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL`,
    );
  }
}

const { rows: kolom } = await klien.query(
  `SELECT table_name, column_name, data_type
     FROM information_schema.columns
    WHERE column_name IN ('cancel_reason', 'cancelled_at', 'cancelled_by')
      AND table_name IN ('invoices', 'quotations')
    ORDER BY table_name, column_name`,
);
for (const k of kolom) console.log(`  ${k.table_name}.${k.column_name} · ${k.data_type}`);
if (kolom.length !== 6) throw new Error(`Kolomnya belum lengkap: ${kolom.length} dari 6.`);

const { rows: isi } = await klien.query(
  `SELECT (SELECT count(*) FROM invoices WHERE status = 'cancelled')::int AS inv_batal,
          (SELECT count(*) FROM quotations WHERE status = 'rejected')::int AS quo_tolak`,
);
console.log(
  `Sudah ada sebelumnya: ${isi[0].inv_batal} invoice dibatalkan, ${isi[0].quo_tolak} quotation ditolak — alasannya kosong, dan memang tidak bisa diisi mundur.`,
);

await klien.end();
console.log("Selesai.");
