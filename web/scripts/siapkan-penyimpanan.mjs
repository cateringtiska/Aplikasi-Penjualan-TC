/**
 * Menyiapkan tempat penyimpanan berkas di Supabase Storage.
 *
 *   node scripts/siapkan-penyimpanan.mjs
 *
 * Membuat satu bucket publik bernama "perusahaan" untuk logo dan tanda
 * tangan. Dibuat publik karena isinya memang ikut tercetak di dokumen yang
 * dikirim ke pelanggan — bukan data rahasia. Yang rahasia tetap di database,
 * yang aksesnya sudah dicabut dari peran publik.
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL;
const kunci = process.env.SUPABASE_SECRET_KEY;

if (!url || !kunci) {
  console.error("SUPABASE_URL atau SUPABASE_SECRET_KEY belum diisi di .env");
  process.exit(1);
}

const supabase = createClient(url, kunci, { auth: { persistSession: false } });

const NAMA = "perusahaan";

const { data: adaBucket } = await supabase.storage.getBucket(NAMA);

if (adaBucket) {
  console.log(`Bucket "${NAMA}" sudah ada (publik: ${adaBucket.public}).`);
} else {
  const { error } = await supabase.storage.createBucket(NAMA, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB, sama dengan batas di Laravel
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });

  if (error) {
    console.error("Gagal membuat bucket:", error.message);
    process.exit(1);
  }
  console.log(`Bucket "${NAMA}" dibuat.`);
}

const { data: daftar, error: galatDaftar } = await supabase.storage.listBuckets();
if (galatDaftar) {
  console.error("Gagal membaca daftar bucket:", galatDaftar.message);
  process.exit(1);
}

console.log("\nBucket yang ada:");
for (const b of daftar) {
  console.log(`  ${b.name}  publik=${b.public}`);
}
