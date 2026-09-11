/**
 * Memindahkan data dari MySQL lokal (Laragon) ke Supabase.
 *
 *   node scripts/pindah-data.mjs             -> hanya memeriksa, tidak menulis
 *   node scripts/pindah-data.mjs --jalankan  -> benar-benar memindahkan
 *
 * ATURAN YANG DIPEGANG
 *
 * 1. ID ASLI DIPERTAHANKAN. Sebelas tabel saling merujuk lewat id; kalau
 *    dinomori ulang, setiap rujukan harus dipetakan dan satu saja yang luput
 *    berarti tagihan menempel ke pelanggan yang salah. Setelah selesai,
 *    penghitung id PostgreSQL dimajukan ke nilai tertinggi.
 *
 * 2. TABEL company_settings TIDAK IKUT. Isinya di MySQL menunjuk ke berkas
 *    logo dan tanda tangan di disk Laragon yang tidak terjangkau dari Vercel.
 *    Pengaturan yang sudah diisi lewat aplikasi baru tetap utuh.
 *
 * 3. UANG DIPINDAH SEBAGAI TEKS. Nilai decimal dibaca apa adanya dari MySQL
 *    dan diserahkan ke PostgreSQL tanpa pernah melewati angka pecahan
 *    JavaScript, yang tidak bisa menyimpan sebagian nilai dengan tepat.
 *
 * 4. HASILNYA DIBANDINGKAN. Setelah pindah, jalankan banding-data.mjs —
 *    jumlah baris dan total uang di kedua database harus sama persis.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import "dotenv/config";

const JALANKAN = process.argv.includes("--jalankan");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

const my = await mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "db_penjualan_tc",
  // Tanggal dibaca sebagai teks supaya tidak bergeser mengikuti zona waktu,
  // dan decimal tetap teks supaya nilainya tidak pernah melewati float.
  dateStrings: true,
  decimalNumbers: false,
});

const baca = async (sql) => (await my.query(sql))[0];

/* -------------------------------------------------------------------------
   Pengubah bentuk nilai
   ------------------------------------------------------------------------- */

const bigint = (v) => (v === null || v === undefined ? null : BigInt(v));
const bool = (v) => v === 1 || v === true || v === "1";
const angka = (v) => (v === null || v === undefined ? null : Number(v));
const teks = (v) => (v === null || v === undefined ? null : String(v));

/**
 * Nama pengguna diturunkan dari bagian depan email.
 *
 * Bentroknya ditangani setelahnya, saat baris disiapkan — bukan di sini,
 * supaya fungsinya tetap murni dan bisa dipakai berulang.
 */
function usernameDari(email, nama) {
  const dasar = (String(email ?? "").split("@")[0] || String(nama ?? "") || "pengguna")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);

  return dasar.length >= 3 ? dasar : `pengguna${String(Date.now()).slice(-4)}`;
}

/** "2026-09-10" atau "2026-09-10 08:15:00" menjadi Date, tanpa pergeseran zona. */
function tanggal(v) {
  if (!v) return null;
  const s = String(v);
  return new Date(s.includes(" ") ? `${s.replace(" ", "T")}Z` : `${s}T00:00:00Z`);
}

/* -------------------------------------------------------------------------
   Urutan pemindahan mengikuti ketergantungan antar tabel
   ------------------------------------------------------------------------- */

const RENCANA = [
  {
    tabel: "users",
    ubah: (r) => ({
      id: bigint(r.id),
      name: r.name,
      // Tabel MySQL lama belum punya kolom nama pengguna — aplikasi Laravel
      // masuk lewat email. Nama penggunanya diturunkan dari bagian depan
      // email, sama seperti yang dilakukan scripts/tambah-username.mjs.
      username: usernameDari(r.email, r.name),
      email: teks(r.email)?.toLowerCase() ?? null,
      email_verified_at: tanggal(r.email_verified_at),
      password: r.password, // hash $2y$ Laravel; lib/auth.ts sudah menanganinya
      remember_token: teks(r.remember_token),
      role: r.role,
      is_active: bool(r.is_active),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "customers",
    ubah: (r) => ({
      id: bigint(r.id),
      customer_code: r.customer_code,
      name: r.name,
      address: teks(r.address),
      phone: teks(r.phone),
      email: teks(r.email),
      npwp: teks(r.npwp),
      pic_name: teks(r.pic_name),
      status: r.status,
      created_by: bigint(r.created_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "products",
    ubah: (r) => ({
      id: bigint(r.id),
      product_code: r.product_code,
      name: r.name,
      type: r.type,
      unit: r.unit,
      default_price: teks(r.default_price),
      description: teks(r.description),
      status: r.status,
      created_by: bigint(r.created_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "quotations",
    ubah: (r) => ({
      id: bigint(r.id),
      quotation_number: r.quotation_number,
      customer_id: bigint(r.customer_id),
      contact_person: teks(r.contact_person),
      contact_phone: teks(r.contact_phone),
      quotation_date: tanggal(r.quotation_date),
      valid_until: tanggal(r.valid_until),
      event_date: tanggal(r.event_date),
      event_days: angka(r.event_days),
      event_type: teks(r.event_type),
      event_time: teks(r.event_time),
      guest_count: angka(r.guest_count),
      fnb_planner: teks(r.fnb_planner),
      venue: teks(r.venue),
      status: r.status,
      notes: teks(r.notes),
      subtotal: teks(r.subtotal),
      service_charge_percent: teks(r.service_charge_percent),
      service_charge_amount: teks(r.service_charge_amount),
      pb1_enabled: bool(r.pb1_enabled),
      pb1_percent: teks(r.pb1_percent),
      pb1_amount: teks(r.pb1_amount),
      grand_total: teks(r.grand_total),
      show_payment_terms: bool(r.show_payment_terms),
      payment_terms: teks(r.payment_terms),
      created_by: bigint(r.created_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "quotation_items",
    bertingkat: true,
    ubah: (r) => ({
      id: bigint(r.id),
      quotation_id: bigint(r.quotation_id),
      parent_id: bigint(r.parent_id),
      product_id: bigint(r.product_id),
      item_name: r.item_name,
      unit: teks(r.unit),
      qty: teks(r.qty),
      price: teks(r.price),
      subtotal: teks(r.subtotal),
      is_compliment: bool(r.is_compliment),
      charge_service: bool(r.charge_service),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "invoices",
    ubah: (r) => ({
      id: bigint(r.id),
      invoice_number: r.invoice_number,
      quotation_id: bigint(r.quotation_id),
      customer_id: bigint(r.customer_id),
      contact_person: teks(r.contact_person),
      contact_phone: teks(r.contact_phone),
      invoice_date: tanggal(r.invoice_date),
      due_date: tanggal(r.due_date),
      event_date: tanggal(r.event_date),
      event_days: angka(r.event_days),
      event_type: teks(r.event_type),
      event_time: teks(r.event_time),
      guest_count: angka(r.guest_count),
      fnb_planner: teks(r.fnb_planner),
      venue: teks(r.venue),
      status: r.status,
      notes: teks(r.notes),
      subtotal: teks(r.subtotal),
      service_charge_percent: teks(r.service_charge_percent),
      service_charge_amount: teks(r.service_charge_amount),
      pb1_enabled: bool(r.pb1_enabled),
      pb1_percent: teks(r.pb1_percent),
      pb1_amount: teks(r.pb1_amount),
      grand_total: teks(r.grand_total),
      paid_amount: teks(r.paid_amount),
      show_payment_terms: bool(r.show_payment_terms),
      payment_terms: teks(r.payment_terms),
      created_by: bigint(r.created_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "invoice_items",
    bertingkat: true,
    ubah: (r) => ({
      id: bigint(r.id),
      invoice_id: bigint(r.invoice_id),
      parent_id: bigint(r.parent_id),
      product_id: bigint(r.product_id),
      item_name: r.item_name,
      unit: teks(r.unit),
      qty: teks(r.qty),
      price: teks(r.price),
      subtotal: teks(r.subtotal),
      is_compliment: bool(r.is_compliment),
      charge_service: bool(r.charge_service),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "payments",
    ubah: (r) => ({
      id: bigint(r.id),
      payment_number: r.payment_number,
      payment_date: tanggal(r.payment_date),
      customer_id: bigint(r.customer_id),
      payment_method: r.payment_method,
      bank_cash: teks(r.bank_cash),
      total_amount: teks(r.total_amount),
      notes: teks(r.notes),
      created_by: bigint(r.created_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "payment_details",
    ubah: (r) => ({
      id: bigint(r.id),
      payment_id: bigint(r.payment_id),
      invoice_id: bigint(r.invoice_id),
      amount_applied: teks(r.amount_applied),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "invoice_costs",
    ubah: (r) => ({
      id: bigint(r.id),
      invoice_id: bigint(r.invoice_id),
      category: r.category,
      description: r.description,
      estimated_amount: teks(r.estimated_amount),
      actual_amount: teks(r.actual_amount),
      status: r.status,
      notes: teks(r.notes),
      created_by: bigint(r.created_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
  {
    tabel: "invoice_margins",
    ubah: (r) => ({
      id: bigint(r.id),
      invoice_id: bigint(r.invoice_id),
      net_sales: teks(r.net_sales),
      total_cost: teks(r.total_cost),
      profit: teks(r.profit),
      margin_percent: teks(r.margin_percent),
      profit_status: r.profit_status,
      status: r.status,
      finalized_at: tanggal(r.finalized_at),
      finalized_by: bigint(r.finalized_by),
      created_at: tanggal(r.created_at),
      updated_at: tanggal(r.updated_at),
    }),
  },
];

/* -------------------------------------------------------------------------
   Pemeriksaan sebelum menulis apa pun
   ------------------------------------------------------------------------- */

console.log(
  JALANKAN
    ? "MODE: MEMINDAHKAN\n"
    : "MODE: PERIKSA SAJA — tambahkan --jalankan untuk benar-benar memindahkan\n",
);

// Diambil lengkap dengan hash sandinya, karena akun yang hanya ada di
// Supabase akan dikembalikan setelah pemindahan — lihat catatan di bawah.
const penggunaSupabase = await prisma.users.findMany({ orderBy: { id: "asc" } });
const emailMysql = (await baca("SELECT email FROM users")).map((r) =>
  String(r.email).toLowerCase(),
);

console.log("Akun yang sudah ada di Supabase:");
for (const p of penggunaSupabase) {
  const bentrok = emailMysql.includes(p.email.toLowerCase());
  console.log(`  id=${p.id}  ${p.email}${bentrok ? "  (email sama dengan di MySQL)" : ""}`);
}

const pengaturan = await prisma.company_settings.findFirst();
console.log("\nPengaturan perusahaan di Supabase (tidak akan disentuh):");
console.log(`  nama         : ${pengaturan?.company_name ?? "-"}`);
console.log(`  logo         : ${gambarnya(pengaturan?.logo_path)}`);
console.log(`  tanda tangan : ${gambarnya(pengaturan?.signature_path)}`);

console.log("\nRencana pemindahan:");
let totalBaris = 0;
for (const r of RENCANA) {
  const n = Number((await baca(`SELECT COUNT(*) AS n FROM ${r.tabel}`))[0].n);
  totalBaris += n;
  console.log(`  ${r.tabel.padEnd(18)} ${String(n).padStart(4)} baris`);
}
console.log(`  ${"TOTAL".padEnd(18)} ${String(totalBaris).padStart(4)} baris`);
console.log("\n  company_settings   DIKECUALIKAN — logo & tanda tangan baru tidak boleh tertimpa");

// Akun yang hanya ada di Supabase — biasanya akun yang dibuat saat menyiapkan
// aplikasi. Id-nya bisa bertabrakan dengan id dari MySQL, jadi akun ini
// dikembalikan setelah pemindahan dengan id baru. Tujuannya satu: pemilik
// tidak boleh sampai terkunci di luar kalau ternyata lupa sandi Laravel-nya.
const akunSetup = penggunaSupabase.filter(
  (p) => !emailMysql.includes(p.email.toLowerCase()),
);

if (akunSetup.length > 0) {
  console.log("\nAkun berikut akan DIKEMBALIKAN setelah pemindahan, dengan id baru:");
  for (const p of akunSetup) console.log(`  ${p.email} (${p.role})`);
}

if (!JALANKAN) {
  console.log("\nTidak ada yang diubah.");
  await selesai();
}

/* -------------------------------------------------------------------------
   Pemindahan
   ------------------------------------------------------------------------- */

console.log("\nMengosongkan tabel tujuan…");
await prisma.$executeRawUnsafe(`
  TRUNCATE TABLE
    invoice_margins, invoice_costs, payment_details, payments,
    invoice_items, invoices, quotation_items, quotations,
    products, customers, users
  RESTART IDENTITY CASCADE
`);

let dipindah = 0;
for (const r of RENCANA) {
  const baris = (await baca(`SELECT * FROM ${r.tabel} ORDER BY id`)).map(r.ubah);

  // Dua email berbeda bisa menghasilkan nama pengguna yang sama — misalnya
  // budi@toko.com dan budi@rumah.com. Kolomnya unik, jadi yang kedua diberi
  // angka di belakang alih-alih menggagalkan seluruh pemindahan.
  if (r.tabel === "users") {
    const dipakai = new Set();
    for (const b of baris) {
      let nama = b.username;
      let n = 2;
      while (dipakai.has(nama)) nama = `${b.username}${n++}`;
      dipakai.add(nama);
      b.username = nama;
    }
  }

  if (r.bertingkat) {
    // Baris induk lebih dulu, baru anaknya: parent_id merujuk ke tabel yang
    // sama, jadi urutan id saja tidak menjamin induknya sudah ada.
    const induk = baris.filter((b) => b.parent_id === null);
    const anak = baris.filter((b) => b.parent_id !== null);
    if (induk.length) await prisma[r.tabel].createMany({ data: induk });
    if (anak.length) await prisma[r.tabel].createMany({ data: anak });
  } else if (baris.length) {
    await prisma[r.tabel].createMany({ data: baris });
  }

  dipindah += baris.length;
  console.log(`  ${r.tabel.padEnd(18)} ${String(baris.length).padStart(4)} baris`);
}

// Penghitung id dimajukan; tanpa ini baris baru akan menabrak id yang sudah
// terpakai dan penyimpanan pertama setelah pindah langsung gagal.
console.log("\nMemajukan penghitung id…");
for (const r of RENCANA) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${r.tabel}"', 'id'),
             GREATEST(COALESCE((SELECT MAX(id) FROM "${r.tabel}"), 1), 1))`,
  );
}

// Akun setup dikembalikan TANPA id, supaya PostgreSQL memberinya nomor baru
// dari penghitung yang sudah dimajukan di atas — jadi tidak menabrak id mana
// pun yang baru saja dipindahkan.
if (akunSetup.length > 0) {
  console.log("\nMengembalikan akun setup…");
  for (const p of akunSetup) {
    const dibuat = await prisma.users.create({
      data: {
        name: p.name,
        email: p.email,
        password: p.password,
        role: p.role,
        is_active: p.is_active,
        email_verified_at: p.email_verified_at,
        created_at: p.created_at ?? new Date(),
        updated_at: new Date(),
      },
      select: { id: true, email: true },
    });
    console.log(`  ${dibuat.email} -> id baru ${dibuat.id}`);
  }
}

console.log(`\nSELESAI — ${dipindah} baris dipindahkan.`);
console.log("Berikutnya: node scripts/banding-data.mjs");
await selesai();

/* ------------------------------------------------------------------------- */

function gambarnya(jalur) {
  if (!jalur) return "belum ada";
  return jalur.startsWith("http") ? "sudah diunggah ke Supabase" : "jalur lama Laravel (tidak terbaca)";
}

async function selesai() {
  await my.end();
  await prisma.$disconnect();
  process.exit(0);
}
