/**
 * Menambah kolom pax pada baris item quotation dan invoice.
 *
 * Qty dan satuannya menerangkan BENTUK PENYAJIANNYA — 2 Tampah, 35 Box —
 * sedangkan pax menerangkan BERAPA ORANG yang dilayani. Keduanya sering
 * berbeda: satu tampah bisa untuk dua puluh orang.
 *
 * Selama ini tidak ada kolomnya, jadi angkanya dititipkan di dalam nama
 * itemnya: "TAMPAH BATMAY [20 pax]". Nama yang memuat angka tidak bisa
 * dijumlah, tidak bisa dicari, dan ikut tercetak di dokumen customer.
 *
 * DIBIARKAN KOSONG untuk baris yang sudah ada. Angka pax-nya memang ada di
 * sebagian nama item, tetapi menebaknya dengan membaca tulisan akan diam-
 * diam salah pada baris yang bentuk tulisannya sedikit berbeda — dan yang
 * memakai angka itu adalah dapur.
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

for (const tabel of ["invoice_items", "quotation_items"]) {
  await klien.query(`ALTER TABLE ${tabel} ADD COLUMN IF NOT EXISTS pax INTEGER`);
}

const { rows: kolom } = await klien.query(
  `SELECT table_name, data_type, is_nullable
     FROM information_schema.columns
    WHERE column_name = 'pax' AND table_name IN ('invoice_items', 'quotation_items')
    ORDER BY table_name`,
);
for (const k of kolom) {
  console.log(`  ${k.table_name}.pax · ${k.data_type} · null=${k.is_nullable}`);
}
if (kolom.length !== 2) throw new Error("Kolom pax belum lengkap di kedua tabel.");

const { rows: isi } = await klien.query(
  `SELECT (SELECT count(*) FROM invoice_items)::int AS inv,
          (SELECT count(*) FROM invoice_items WHERE pax IS NOT NULL)::int AS inv_terisi,
          (SELECT count(*) FROM quotation_items)::int AS quo,
          (SELECT count(*) FROM quotation_items WHERE pax IS NOT NULL)::int AS quo_terisi`,
);
const b = isi[0];
console.log(`invoice_items: ${b.inv} baris, pax terisi ${b.inv_terisi}`);
console.log(`quotation_items: ${b.quo} baris, pax terisi ${b.quo_terisi}`);

// Berapa baris yang pax-nya masih tertulis di dalam namanya, supaya
// pemiliknya tahu berapa banyak yang perlu dirapikan tangan.
const { rows: terselip } = await klien.query(
  `SELECT item_name FROM invoice_items WHERE item_name ~* '\[[0-9]+ *pax\]' LIMIT 10`,
);
console.log(`\nNama item yang masih memuat "[n pax]": ${terselip.length}`);
for (const t of terselip) console.log(`  ${t.item_name}`);

await klien.end();
console.log("\nSelesai.");
