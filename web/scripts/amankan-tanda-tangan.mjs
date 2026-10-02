/**
 * Memindahkan gambar tanda tangan ke bucket TERTUTUP.
 *
 * Gambar tanda tangan adalah bahan untuk memalsukan dokumen atas nama orang
 * yang menandatanganinya. Selama ia berada di bucket publik, alamatnya
 * memang tidak bisa ditebak maupun didaftar — tetapi sekali alamat itu
 * diketahui seseorang, ia berlaku SELAMANYA. Satu dokumen yang diteruskan,
 * satu tangkapan layar, satu riwayat peramban sudah cukup.
 *
 * Sesudah skrip ini: yang tersimpan di database adalah jalur berkasnya, dan
 * tautannya dibuat baru setiap dokumen dibuka, berumur sepuluh menit.
 *
 * Dijalankan sekali: node scripts/amankan-tanda-tangan.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";

for (const b of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = b.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BUCKET_LAMA = "perusahaan";
const BUCKET_BARU = "tanda-tangan";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL, max: 1 }),
});

/* ---------- 1. Bucket tertutup ---------- */

const { data: daftar } = await sb.storage.listBuckets();
if (!daftar?.some((b) => b.name === BUCKET_BARU)) {
  const { error } = await sb.storage.createBucket(BUCKET_BARU, { public: false });
  if (error) throw new Error(`Bucket gagal dibuat: ${error.message}`);
  console.log(`Bucket "${BUCKET_BARU}" dibuat (tertutup).`);
} else {
  // Sudah ada — pastikan memang tertutup, jangan dianggap begitu saja.
  const { error } = await sb.storage.updateBucket(BUCKET_BARU, { public: false });
  if (error) throw new Error(`Bucket gagal ditutup: ${error.message}`);
  console.log(`Bucket "${BUCKET_BARU}" sudah ada, dipastikan tertutup.`);
}

/* ---------- 2. Pindahkan berkasnya ---------- */

const p = await prisma.company_settings.findUnique({
  where: { id: 1n },
  select: { signature_path: true },
});

const lama = p?.signature_path ?? null;

if (!lama) {
  console.log("Tidak ada tanda tangan tersimpan. Tidak ada yang dipindahkan.");
} else if (!lama.startsWith("http")) {
  console.log(`Sudah berupa jalur, bukan tautan: ${lama}. Tidak ada yang dipindahkan.`);
} else {
  const penanda = `/storage/v1/object/public/${BUCKET_LAMA}/`;
  const posisi = lama.indexOf(penanda);
  if (posisi === -1) throw new Error(`Bentuk tautan tidak dikenali: ${lama}`);

  const jalurLama = lama.slice(posisi + penanda.length);        // tanda-tangan/uuid.jpg
  const jalurBaru = jalurLama.replace(/^tanda-tangan\//, "");   // uuid.jpg

  const { data: isi, error: galatUnduh } = await sb.storage.from(BUCKET_LAMA).download(jalurLama);
  if (galatUnduh || !isi) throw new Error(`Gagal mengunduh berkas lama: ${galatUnduh?.message}`);

  const { error: galatUnggah } = await sb.storage.from(BUCKET_BARU).upload(
    jalurBaru,
    await isi.arrayBuffer(),
    { contentType: isi.type || "image/jpeg", upsert: true },
  );
  if (galatUnggah) throw new Error(`Gagal mengunggah ke bucket tertutup: ${galatUnggah.message}`);

  // Database diperbarui SEBELUM berkas lama dihapus. Urutan ini yang membuat
  // dokumen tidak pernah menunjuk ke berkas yang sudah tidak ada.
  await prisma.company_settings.update({
    where: { id: 1n },
    data: { signature_path: jalurBaru, updated_at: new Date() },
  });

  const { error: galatHapus } = await sb.storage.from(BUCKET_LAMA).remove([jalurLama]);
  if (galatHapus) console.warn(`Berkas lama belum terhapus: ${galatHapus.message}`);

  console.log(`Dipindahkan: ${jalurLama} -> ${BUCKET_BARU}/${jalurBaru}`);

  /* ---------- 3. Dibuktikan, bukan dianggap ---------- */

  const sesudah = await prisma.company_settings.findUniqueOrThrow({
    where: { id: 1n },
    select: { signature_path: true },
  });
  console.log(`Nilai di database sekarang: ${sesudah.signature_path}`);

  // Alamat publik Supabase lewat CDN. Sesaat setelah berkasnya dihapus, CDN
  // masih menyajikan salinan basi — jadi satu kali periksa bisa menjawab 200
  // untuk berkas yang sebenarnya sudah tidak ada. Diperiksa berulang dengan
  // alamat yang dibedakan, supaya yang terbaca keadaan sesungguhnya.
  let status = 0;
  for (let coba = 1; coba <= 6; coba++) {
    const tanggapan = await fetch(`${lama}?periksa=${Date.now()}`, { cache: "no-store" });
    status = tanggapan.status;
    if (!tanggapan.ok) break;
    console.log(`  alamat lama masih menjawab 200 (percobaan ${coba}) — menunggu CDN`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log(`Alamat publik lama menjawab: HTTP ${status} (harus 400 atau 404)`);
  if (status >= 200 && status < 300) {
    throw new Error("Alamat lama MASIH HIDUP. Pemindahan belum menutup apa pun.");
  }

  const { data: ditandatangani, error: galatTautan } = await sb.storage
    .from(BUCKET_BARU)
    .createSignedUrl(sesudah.signature_path, 60);
  if (galatTautan || !ditandatangani) throw new Error("Tautan bertanda waktu gagal dibuat.");

  const uji = await fetch(ditandatangani.signedUrl);
  console.log(`Tautan bertanda waktu menjawab: HTTP ${uji.status} (harus 200)`);
  if (!uji.ok) throw new Error("Tautan bertanda waktu tidak bisa dibuka.");
}

await prisma.$disconnect();
console.log("selesai");
