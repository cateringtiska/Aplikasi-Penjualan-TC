import "server-only";

import { createClient } from "@supabase/supabase-js";

/* ==========================================================================
   PENYIMPANAN BERKAS — Supabase Storage

   Logo dan tanda tangan TIDAK boleh disimpan di disk server. Di hosting
   serverless, disk aplikasi bersifat sementara: setiap kali aplikasi
   di-deploy ulang, berkasnya hilang dan dokumen tagihan terbit tanpa kop
   maupun tanda tangan. Ini salah satu temuan audit terhadap versi Laravel.

   DUA TEMPAT, DUA SIFAT YANG BERBEDA:

   LOGO ada di bucket PUBLIK. Logo perusahaan memang barang umum — ia
   tercetak di setiap dokumen yang dikirim keluar. Yang disimpan di database
   adalah tautan penuh, supaya dokumen cetak bisa memuatnya langsung.

   TANDA TANGAN ada di bucket TERTUTUP. Gambar tanda tangan adalah bahan
   untuk memalsukan dokumen atas nama orang yang menandatanganinya. Di bucket
   publik, alamatnya memang tidak bisa ditebak maupun didaftar — tetapi
   sekali alamat itu diketahui seseorang, ia berlaku SELAMANYA dan tidak ada
   cara menariknya kembali selain mengganti gambarnya. Yang disimpan di
   database adalah JALUR BERKASNYA saja, dan tautannya dibuat baru setiap
   dokumen dibuka, berumur beberapa menit.
   ========================================================================== */

const BUCKET = "perusahaan";
/** Bucket tertutup; isinya hanya bisa diambil lewat tautan bertanda waktu. */
const BUCKET_TANDA_TANGAN = "tanda-tangan";
/**
 * Umur tautan tanda tangan.
 *
 * Cukup untuk memuat halaman lalu mencetaknya, dan terlalu pendek untuk
 * berguna bagi siapa pun yang menyalin alamatnya dari dokumen yang diteruskan.
 */
const UMUR_TAUTAN_DETIK = 10 * 60;
const BATAS_BYTE = 2 * 1024 * 1024;
const JENIS_DIIZINKAN = ["image/png", "image/jpeg", "image/webp"];

function klien() {
  const url = process.env.SUPABASE_URL;
  const kunci = process.env.SUPABASE_SECRET_KEY;

  if (!url || !kunci) {
    throw new Error(
      "SUPABASE_URL atau SUPABASE_SECRET_KEY belum diisi. Unggahan berkas tidak bisa dijalankan.",
    );
  }

  return createClient(url, kunci, { auth: { persistSession: false } });
}

export type HasilUnggah =
  | { ok: true; tautan: string }
  | { ok: false; pesan: string };

function periksaGambar(berkas: File): string | null {
  if (berkas.size === 0) return "Berkas kosong.";
  if (berkas.size > BATAS_BYTE) return "Ukuran gambar maksimal 2 MB.";
  if (!JENIS_DIIZINKAN.includes(berkas.type)) {
    return "Gambar harus berformat PNG, JPG, atau WebP.";
  }
  return null;
}

function ekstensiDari(berkas: File): string {
  if (berkas.type === "image/png") return "png";
  if (berkas.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Mengunggah satu gambar dan mengembalikan tautan publiknya.
 *
 * Nama berkasnya diacak, jadi mengunggah logo baru tidak menimpa yang lama
 * dan dokumen lama tetap menampilkan logo yang dipakai saat itu.
 */
export async function unggahGambar(berkas: File, awalan: string): Promise<HasilUnggah> {
  const salah = periksaGambar(berkas);
  if (salah) return { ok: false, pesan: salah };

  const nama = `${awalan}/${crypto.randomUUID()}.${ekstensiDari(berkas)}`;

  const { error } = await klien()
    .storage.from(BUCKET)
    .upload(nama, await berkas.arrayBuffer(), {
      contentType: berkas.type,
      upsert: false,
    });

  if (error) {
    return { ok: false, pesan: `Gambar gagal diunggah: ${error.message}` };
  }

  const { data } = klien().storage.from(BUCKET).getPublicUrl(nama);
  return { ok: true, tautan: data.publicUrl };
}

/** Menghapus berkas lama setelah penggantinya berhasil tersimpan. */
export async function hapusGambar(tautan: string | null): Promise<void> {
  if (!tautan) return;

  const penanda = `/storage/v1/object/public/${BUCKET}/`;
  const posisi = tautan.indexOf(penanda);
  if (posisi === -1) return; // Berkas lama Laravel — tidak ada di sini.

  const jalur = tautan.slice(posisi + penanda.length);
  await klien().storage.from(BUCKET).remove([jalur]);
}

/* -------------------------------------------------------------------------
   TANDA TANGAN — bucket tertutup, tautan bertanda waktu
   ------------------------------------------------------------------------- */

export type HasilUnggahTandaTangan =
  | { ok: true; jalur: string }
  | { ok: false; pesan: string };

/**
 * Mengunggah tanda tangan dan mengembalikan JALUR berkasnya, bukan tautan.
 *
 * Bedanya dengan logo bukan sekadar nama fungsi: yang tersimpan di database
 * tidak bisa dibuka siapa pun tanpa melewati aplikasi ini lebih dulu.
 */
export async function unggahTandaTangan(berkas: File): Promise<HasilUnggahTandaTangan> {
  const salah = periksaGambar(berkas);
  if (salah) return { ok: false, pesan: salah };

  const jalur = `${crypto.randomUUID()}.${ekstensiDari(berkas)}`;

  const { error } = await klien()
    .storage.from(BUCKET_TANDA_TANGAN)
    .upload(jalur, await berkas.arrayBuffer(), {
      contentType: berkas.type,
      upsert: false,
    });

  if (error) {
    return { ok: false, pesan: `Tanda tangan gagal diunggah: ${error.message}` };
  }

  return { ok: true, jalur };
}

export async function hapusTandaTangan(jalur: string | null): Promise<void> {
  if (!jalur || jalur.startsWith("http")) return;
  await klien().storage.from(BUCKET_TANDA_TANGAN).remove([jalur]);
}

/**
 * Membuat tautan berumur pendek untuk satu tanda tangan.
 *
 * Nilai yang masih berupa tautan `http` adalah peninggalan sebelum tanda
 * tangan dipindah ke bucket tertutup. Ia dikembalikan apa adanya supaya
 * dokumen lama tidak mendadak terbit tanpa tanda tangan — tetapi setelah
 * skrip pemindahan dijalankan, tidak ada lagi nilai berbentuk itu.
 */
export async function tautanTandaTangan(jalur: string | null): Promise<string | null> {
  if (!jalur) return null;
  if (jalur.startsWith("http")) return jalur;

  const { data, error } = await klien()
    .storage.from(BUCKET_TANDA_TANGAN)
    .createSignedUrl(jalur, UMUR_TAUTAN_DETIK);

  if (error || !data) {
    // Dokumen tetap terbit, hanya tanpa gambar tanda tangannya. Nama
    // penanda tangan dicetak dari kolom terpisah, jadi dokumennya masih
    // menyebut siapa yang bertanggung jawab.
    console.error("Tautan tanda tangan gagal dibuat", error);
    return null;
  }

  return data.signedUrl;
}
