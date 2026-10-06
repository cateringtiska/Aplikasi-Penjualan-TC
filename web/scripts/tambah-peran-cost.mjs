/**
 * Menambah peran "cost" di database.
 *
 * Dua hal yang HARUS ikut diubah, dan keduanya tidak kelihatan dari kode:
 *
 *  1. Batasan users_role_check masih menyebut tiga peran saja. Tanpa
 *     dilebarkan, layar User tetap menampilkan pilihan "Cost" dan tetap
 *     menerima kirimannya — lalu gagal di detik terakhir dengan galat
 *     database mentah yang tidak bisa dibaca pemakainya.
 *
 *  2. Tabel role_permissions belum punya baris untuk peran ini. Baris yang
 *     belum ada memang memakai aturan bawaan di lib/navigasi.ts, jadi
 *     aplikasinya tetap jalan — tetapi tabel hak akses di layar User
 *     menggambar centangnya dari sana, dan admin yang mencentang satu kotak
 *     akan menyimpan hanya kotak itu.
 */
import "dotenv/config";
import pg from "pg";

// Bawaan untuk peran Cost. Disalin dari lib/navigasi.ts; yang berlaku
// sehari-hari tetap isi tabel ini, yang bisa diubah admin kapan saja.
const BAWAAN = {
  dasbor: true,
  penawaran: true,
  tagihan: true,
  pembayaran: false,
  "laporan-penjualan": false,
  "laporan-piutang": false,
  "laporan-margin": true,
  pelanggan: false,
  produk: true,
};

const url = new URL(process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
url.searchParams.delete("uselibpqcompat");

const klien = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
});
await klien.connect();

try {
  await klien.query("BEGIN");

  // Batasannya dibuang lalu dipasang ulang dengan daftar yang lengkap.
  // Namanya tetap sama supaya tidak ada dua batasan yang saling menumpuk.
  await klien.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await klien.query(
    `ALTER TABLE users ADD CONSTRAINT users_role_check
       CHECK (role IN ('admin', 'sales', 'finance', 'cost'))`,
  );

  for (const [kunci, boleh] of Object.entries(BAWAAN)) {
    await klien.query(
      `INSERT INTO role_permissions (role, menu_key, allowed, created_at, updated_at)
       VALUES ('cost', $1, $2, now(), now())
       ON CONFLICT (role, menu_key) DO NOTHING`,
      [kunci, boleh],
    );
  }

  await klien.query("COMMIT");
} catch (galat) {
  await klien.query("ROLLBACK");
  throw galat;
}

// Dibaca ULANG setelah ditulis: yang dipercaya adalah isi database, bukan
// perintah yang sudah dijalankan.
const { rows: batasan } = await klien.query(
  `SELECT pg_get_constraintdef(oid) AS isi FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_role_check'`,
);
console.log("users_role_check →", batasan[0]?.isi ?? "TIDAK ADA");
if (!batasan[0]?.isi?.includes("cost")) throw new Error("Batasan peran belum memuat 'cost'.");

const { rows: izin } = await klien.query(
  `SELECT menu_key, allowed FROM role_permissions WHERE role = 'cost' ORDER BY menu_key`,
);
console.log(`Izin peran cost (${izin.length} baris):`);
for (const r of izin) console.log(`  ${r.allowed ? "✓" : "·"} ${r.menu_key}`);

if (izin.length !== Object.keys(BAWAAN).length) {
  throw new Error(`Baris izin cost kurang: ${izin.length} dari ${Object.keys(BAWAAN).length}.`);
}

// Dicoba sungguhan: batasan yang benar harus MENERIMA 'cost' dan tetap
// MENOLAK peran yang tidak dikenal. Keduanya dibatalkan setelahnya.
const coba = async (peran) => {
  await klien.query("BEGIN");
  try {
    await klien.query(
      `INSERT INTO users (name, username, email, password, role, is_active, created_at, updated_at)
       VALUES ('Coba Batasan', $1, $2, $3, $4, false, now(), now())`,
      [`cobabatasan${Date.now()}`, `cobabatasan${Date.now()}@contoh.invalid`, "x".repeat(60), peran],
    );
    return true;
  } catch {
    return false;
  } finally {
    await klien.query("ROLLBACK");
  }
};

const terima = await coba("cost");
const tolak = await coba("gudang");
console.log(`peran 'cost' diterima: ${terima} · peran asing 'gudang' ditolak: ${!tolak}`);
if (!terima || tolak) throw new Error("Batasan perannya tidak berperilaku seperti seharusnya.");

await klien.end();
console.log("Selesai.");
