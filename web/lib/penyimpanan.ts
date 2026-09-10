import "server-only";

import { createClient } from "@supabase/supabase-js";

/* ==========================================================================
   PENYIMPANAN BERKAS — Supabase Storage

   Logo dan tanda tangan TIDAK boleh disimpan di disk server. Di hosting
   serverless, disk aplikasi bersifat sementara: setiap kali aplikasi
   di-deploy ulang, berkasnya hilang dan dokumen tagihan terbit tanpa kop
   maupun tanda tangan. Ini salah satu temuan audit terhadap versi Laravel.

   Yang disimpan di database adalah TAUTAN PENUH, bukan jalur relatif, supaya
   dokumen cetak bisa memuatnya langsung.
   ========================================================================== */

const BUCKET = "perusahaan";
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

/**
 * Mengunggah satu gambar dan mengembalikan tautan publiknya.
 *
 * Nama berkasnya diacak, jadi mengunggah logo baru tidak menimpa yang lama
 * dan dokumen lama tetap menampilkan logo yang dipakai saat itu.
 */
export async function unggahGambar(berkas: File, awalan: string): Promise<HasilUnggah> {
  if (berkas.size === 0) return { ok: false, pesan: "Berkas kosong." };

  if (berkas.size > BATAS_BYTE) {
    return { ok: false, pesan: "Ukuran gambar maksimal 2 MB." };
  }

  if (!JENIS_DIIZINKAN.includes(berkas.type)) {
    return { ok: false, pesan: "Gambar harus berformat PNG, JPG, atau WebP." };
  }

  const ekstensi = berkas.type === "image/png" ? "png" : berkas.type === "image/webp" ? "webp" : "jpg";
  const nama = `${awalan}/${crypto.randomUUID()}.${ekstensi}`;

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
