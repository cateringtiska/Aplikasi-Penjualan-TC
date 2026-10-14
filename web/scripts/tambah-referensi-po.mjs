/**
 * Menambah kolom referensi PO pada invoice.
 *
 * Customer korporat membayar berdasarkan nomor PO mereka sendiri: invoice
 * tanpa nomor itu tertahan di bagian hutang mereka, dan yang menagih baru
 * mengetahuinya berminggu-minggu kemudian.
 *
 * Hanya di invoice. Quotation adalah penawaran yang justru MENDAHULUI PO
 * customer, jadi kolom itu di sana akan selalu kosong.
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

await klien.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_reference VARCHAR(255)`);

const { rows: kolom } = await klien.query(
  `SELECT data_type, character_maximum_length, is_nullable
     FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'po_reference'`,
);
console.log("invoices.po_reference →", JSON.stringify(kolom[0] ?? null));
if (kolom.length !== 1) throw new Error("Kolom po_reference belum ada.");

const { rows: isi } = await klien.query(
  `SELECT count(*)::int AS semua,
          count(*) FILTER (WHERE po_reference IS NOT NULL)::int AS terisi
     FROM invoices`,
);
console.log(`Invoice: ${isi[0].semua} baris, po_reference terisi ${isi[0].terisi}`);

await klien.end();
console.log("Selesai.");
