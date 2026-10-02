/**
 * Menambahkan kode bank dan swift code ke pengaturan perusahaan, lalu
 * menyelaraskan seluruh penyebutan rekening.
 *
 * Keterangan pembayaran di dokumen memuat lima hal, dan dua di antaranya
 * belum punya tempat: kode bank dan swift code. Keduanya DATA PERUSAHAAN,
 * bukan tulisan tetap di dalam kode — ia bisa berubah tanpa saya.
 *
 * Sekalian: cabang rekening tertulis "KCU Tendean Jakarta" di kedua teks
 * syarat, padahal yang benar KCP MONGINSIDI. Kalau hanya kotak pembayaran
 * yang diperbaiki, satu dokumen akan menyebut dua cabang yang berbeda —
 * persis seperti yang dulu terjadi pada nomor rekeningnya.
 *
 * Dijalankan sekali: node scripts/tambah-kode-bank.mjs
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

await klien.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_code  VARCHAR(255)`);
await klien.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS swift_code VARCHAR(255)`);

const ISI = {
  bank_name: "BCA [Bank Central Asia] - KCP Monginsidi",
  bank_account_number: "210 - 999 - 8880",
  bank_account_holder: "PT. TISKA CIPTA IMAJI",
  bank_code: "014 - 0397 (KPO)",
  swift_code: "CENAIDJA",
};

await klien.query(
  `UPDATE company_settings
      SET bank_name = $1, bank_account_number = $2, bank_account_holder = $3,
          bank_code = $4, swift_code = $5, updated_at = now()
    WHERE id = 1`,
  Object.values(ISI),
);

// Cabang di kedua teks syarat. Diganti dengan penggantian teks yang sempit,
// bukan menulis ulang seluruh syaratnya — isinya 12.541 huruf, dan menulis
// ulang berarti bisa menghilangkan pasal yang tidak saya ketahui isinya.
const { rows: sebelum } = await klien.query(
  `SELECT quotation_terms_default, payment_terms_default FROM company_settings WHERE id = 1`,
);

const ganti = (teks) =>
  (teks ?? "")
    .replace(/BCA\s*-\s*KCU Tendean Jakarta/gi, "BCA - KCP Monginsidi")
    .replace(/KCU Tendean Jakarta/gi, "KCP Monginsidi");

await klien.query(
  `UPDATE company_settings
      SET quotation_terms_default = $1, payment_terms_default = $2, updated_at = now()
    WHERE id = 1`,
  [ganti(sebelum[0].quotation_terms_default), ganti(sebelum[0].payment_terms_default)],
);

/* ---------- Dibaca ulang, bukan dianggap berhasil ---------- */

const { rows } = await klien.query(
  `SELECT bank_name, bank_account_number, bank_account_holder, bank_code, swift_code,
          quotation_terms_default, payment_terms_default
     FROM company_settings WHERE id = 1`,
);
const p = rows[0];

for (const [k, v] of Object.entries(ISI)) {
  console.log(`${k.padEnd(20)}: ${p[k]}${p[k] === v ? "" : "  <-- TIDAK COCOK"}`);
}

for (const kunci of ["quotation_terms_default", "payment_terms_default"]) {
  const sisa = (p[kunci].match(/KCU Tendean/gi) ?? []).length;
  const baru = (p[kunci].match(/KCP Monginsidi/gi) ?? []).length;
  console.log(`${kunci}: "KCU Tendean" tersisa ${sisa}, "KCP Monginsidi" ada ${baru}`);
  if (sisa > 0) throw new Error(`${kunci} masih menyebut cabang lama.`);
}

// Dokumen yang SUDAH TERBIT menyimpan salinan syaratnya sendiri.
const { rows: dokumen } = await klien.query(`
  SELECT 'quotation' AS jenis, count(*) AS n FROM quotations WHERE payment_terms ILIKE '%KCU Tendean%'
  UNION ALL
  SELECT 'invoice', count(*) FROM invoices WHERE payment_terms ILIKE '%KCU Tendean%'
`);
for (const d of dokumen) console.log(`${d.jenis} yang masih menyebut cabang lama: ${d.n}`);

await klien.end();
console.log("selesai");
