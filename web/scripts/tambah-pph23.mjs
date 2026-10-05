/**
 * Menambahkan kolom PPh 23 pada pembayaran.
 *
 * Customer yang berstatus pemotong pajak menahan 2% dari nilai jasa katering
 * — harga makanan dan service charge — lalu menyetorkannya ke kas negara
 * ATAS NAMA perusahaan, dan memberikan bukti potong.
 *
 * Akibatnya uang yang masuk ke rekening LEBIH KECIL daripada yang menutup
 * invoice. Invoice-nya tetap LUNAS: yang dipotong itu bukan hilang, melainkan
 * sudah dibayarkan ke negara dan bisa dikreditkan pada SPT tahunan. Mencatat
 * invoicenya kurang bayar sebesar potongan itu akan membuat piutang yang
 * tidak akan pernah bisa ditagih kepada siapa pun.
 *
 * Nomor bukti potongnya ikut disimpan: tanpa nomor itu, potongannya tidak
 * bisa dikreditkan, dan dua persen itu benar-benar hilang.
 *
 * Dijalankan sekali: node scripts/tambah-pph23.mjs
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

const { rows: sebelum } = await klien.query(
  `SELECT payment_number, total_amount FROM payments ORDER BY id`,
);

await klien.query(
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS pph23_amount NUMERIC(15,2) NOT NULL DEFAULT 0`,
);
await klien.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS pph23_bukti VARCHAR(255)`);

const { rows: kolom } = await klien.query(
  `SELECT column_name, data_type, column_default
     FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name IN ('pph23_amount', 'pph23_bukti')
    ORDER BY column_name`,
);
for (const k of kolom) console.log(`payments.${k.column_name}: ${k.data_type} default=${k.column_default ?? "-"}`);

// Pembayaran yang sudah ada tidak boleh bergeser nilainya.
const { rows: sesudah } = await klien.query(
  `SELECT payment_number, total_amount, pph23_amount FROM payments ORDER BY id`,
);

let beda = 0;
for (let i = 0; i < sebelum.length; i++) {
  if (sebelum[i].total_amount !== sesudah[i].total_amount) {
    console.log(`BERUBAH ${sebelum[i].payment_number}`);
    beda++;
  }
  if (Number(sesudah[i].pph23_amount) !== 0) {
    console.log(`PPh23 bukan nol pada ${sesudah[i].payment_number}`);
    beda++;
  }
}
console.log(`${sebelum.length} payment diperiksa, ${beda} bermasalah`);
if (beda > 0) throw new Error("Ada pembayaran yang nilainya berubah.");

await klien.end();
console.log("selesai");
