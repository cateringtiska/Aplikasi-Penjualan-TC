/**
 * Menambah penanda revisi pada invoice.
 *
 * Invoice yang sudah menerima payment kini boleh diubah, tetapi hanya NAIK
 * -- karena ada tambahan menu saat acara berlangsung. Dokumen yang sudah
 * dipegang customer karena itu menjadi bukan yang terbaru, dan tanpa
 * penanda tidak ada cara membedakan keduanya: nomornya sama, tanggalnya
 * sama, hanya angkanya berbeda. Dua orang bisa duduk berhadapan memegang
 * kertas yang sama-sama bernama INV-2026-0016 dengan total berbeda.
 *
 * revision = 0 berarti belum pernah direvisi, dan itu keadaan seluruh
 * invoice yang sudah ada sekarang.
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

await klien.query(
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0`,
);
await klien.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revised_at TIMESTAMP(0)`);

// Dibaca ULANG setelah ditulis: yang dipercaya adalah isi database.
const { rows: kolom } = await klien.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name IN ('revision', 'revised_at')
    ORDER BY column_name`,
);
for (const k of kolom) {
  console.log(`  ${k.column_name} · ${k.data_type} · null=${k.is_nullable} · bawaan=${k.column_default ?? "-"}`);
}
if (kolom.length !== 2) throw new Error("Kolom revisinya belum lengkap.");

const { rows: isi } = await klien.query(
  `SELECT count(*)::int AS semua,
          count(*) FILTER (WHERE revision = 0)::int AS belum,
          count(*) FILTER (WHERE revised_at IS NULL)::int AS tanpa_tanggal
     FROM invoices`,
);
console.log(
  `Invoice: ${isi[0].semua} · revision=0: ${isi[0].belum} · revised_at kosong: ${isi[0].tanpa_tanggal}`,
);
if (isi[0].belum !== isi[0].semua) {
  throw new Error("Ada invoice yang terlanjur bertanda revisi padahal belum pernah direvisi.");
}

await klien.end();
console.log("Selesai.");
