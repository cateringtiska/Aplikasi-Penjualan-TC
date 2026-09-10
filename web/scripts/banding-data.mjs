/**
 * Membandingkan MySQL lokal dengan Supabase setelah pemindahan.
 *
 *   node scripts/banding-data.mjs
 *
 * Pemindahan data hanya boleh dipercaya kalau angkanya cocok sampai rupiah
 * terakhir. Skrip ini membandingkan tiga lapis:
 *
 *   1. Jumlah baris tiap tabel.
 *   2. Total uang: nilai tagihan, yang sudah dibayar, dan piutang.
 *   3. Sebaran status tagihan — kalau ini bergeser, laporan piutang ikut salah.
 *
 * Keluar dengan kode 1 bila ada satu saja yang berbeda.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const my = await mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "db_penjualan_tc",
  dateStrings: true,
  decimalNumbers: false,
});

const bacaMy = async (sql) => (await my.query(sql))[0];
const bacaPg = async (sql) => prisma.$queryRawUnsafe(sql);

const rupiah = (v) =>
  `Rp ${Number(v ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

let beda = 0;

function banding(label, kiri, kanan, format = String) {
  const cocok = String(kiri ?? "") === String(kanan ?? "");
  if (!cocok) beda++;
  console.log(
    `  ${cocok ? "OK   " : "BEDA "} ${label.padEnd(26)} MySQL ${format(kiri).padStart(18)}   Supabase ${format(kanan).padStart(18)}`,
  );
}

/* ---------------------------------------------------------------- 1. Baris */

const TABEL = [
  "customers",
  "products",
  "quotations",
  "quotation_items",
  "invoices",
  "invoice_items",
  "payments",
  "payment_details",
  "invoice_costs",
  "invoice_margins",
];

console.log("1. JUMLAH BARIS\n");
for (const t of TABEL) {
  const kiri = Number((await bacaMy(`SELECT COUNT(*) AS n FROM ${t}`))[0].n);
  const kanan = Number((await bacaPg(`SELECT COUNT(*)::int AS n FROM "${t}"`))[0].n);
  banding(t, kiri, kanan);
}

// Pengguna diperiksa terpisah: Supabase boleh punya akun tambahan yang memang
// dibuat di sana (akun setup), jadi jumlahnya tidak harus sama. Yang WAJIB
// sama adalah setiap akun dari MySQL harus ada di Supabase.
const emailMy = (await bacaMy("SELECT LOWER(email) AS e FROM users")).map((r) => r.e);
const emailPg = (await bacaPg('SELECT LOWER(email) AS e FROM "users"')).map((r) => r.e);
const hilang = emailMy.filter((e) => !emailPg.includes(e));
const tambahan = emailPg.filter((e) => !emailMy.includes(e));

if (hilang.length > 0) {
  beda++;
  console.log(`  BEDA  users                      ada ${hilang.length} akun MySQL yang TIDAK pindah: ${hilang.join(", ")}`);
} else {
  console.log(`  OK    users                      seluruh ${emailMy.length} akun MySQL ada di Supabase`);
}
if (tambahan.length > 0) {
  console.log(`        (tambahan di Supabase, bukan masalah: ${tambahan.join(", ")})`);
}

/* ----------------------------------------------------------------- 2. Uang */

console.log("\n2. TOTAL UANG (tagihan yang tidak dibatalkan)\n");

const uangMy = (
  await bacaMy(`
  SELECT COUNT(*) AS jml,
         COALESCE(SUM(grand_total),0) AS nilai,
         COALESCE(SUM(paid_amount),0) AS dibayar,
         COALESCE(SUM(grand_total - paid_amount),0) AS piutang
  FROM invoices WHERE status <> 'cancelled'`)
)[0];

const uangPg = (
  await bacaPg(`
  SELECT COUNT(*)::int AS jml,
         COALESCE(SUM(grand_total),0)::text AS nilai,
         COALESCE(SUM(paid_amount),0)::text AS dibayar,
         COALESCE(SUM(grand_total - paid_amount),0)::text AS piutang
  FROM invoices WHERE status <> 'cancelled'`)
)[0];

banding("jumlah tagihan aktif", uangMy.jml, uangPg.jml);
banding("nilai tagihan", Number(uangMy.nilai), Number(uangPg.nilai), rupiah);
banding("sudah dibayar", Number(uangMy.dibayar), Number(uangPg.dibayar), rupiah);
banding("piutang", Number(uangMy.piutang), Number(uangPg.piutang), rupiah);

const penawaranMy = (
  await bacaMy("SELECT COUNT(*) AS jml, COALESCE(SUM(grand_total),0) AS nilai FROM quotations")
)[0];
const penawaranPg = (
  await bacaPg(
    'SELECT COUNT(*)::int AS jml, COALESCE(SUM(grand_total),0)::text AS nilai FROM "quotations"',
  )
)[0];
banding("nilai seluruh penawaran", Number(penawaranMy.nilai), Number(penawaranPg.nilai), rupiah);

const bayarMy = (
  await bacaMy("SELECT COALESCE(SUM(amount_applied),0) AS n FROM payment_details")
)[0];
const bayarPg = (
  await bacaPg('SELECT COALESCE(SUM(amount_applied),0)::text AS n FROM "payment_details"')
)[0];
banding("total alokasi pembayaran", Number(bayarMy.n), Number(bayarPg.n), rupiah);

/* --------------------------------------------------------------- 3. Status */

console.log("\n3. SEBARAN STATUS TAGIHAN\n");

const statusMy = Object.fromEntries(
  (await bacaMy("SELECT status, COUNT(*) AS n FROM invoices GROUP BY status")).map((r) => [
    r.status,
    Number(r.n),
  ]),
);
const statusPg = Object.fromEntries(
  (await bacaPg('SELECT status, COUNT(*)::int AS n FROM "invoices" GROUP BY status')).map((r) => [
    r.status,
    Number(r.n),
  ]),
);

for (const s of new Set([...Object.keys(statusMy), ...Object.keys(statusPg)])) {
  banding(s, statusMy[s] ?? 0, statusPg[s] ?? 0);
}

/* -------------------------------------------------------------- Kesimpulan */

console.log(
  beda === 0
    ? "\nCOCOK SEMUA — data boleh dipercaya."
    : `\n${beda} perbedaan ditemukan. JANGAN dipakai sebelum ini dibereskan.`,
);

await my.end();
await prisma.$disconnect();
process.exit(beda === 0 ? 0 : 1);
