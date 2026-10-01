import type { Prisma } from "@prisma/client";

import type { BarisTambahanSiap } from "./dokumen";

/* ==========================================================================
   MENULIS BIAYA TAMBAHAN SEBUAH DOKUMEN

   Biaya tambahan adalah baris bernama di luar service charge dan PB1 —
   "Tim Servis utk Menu Buffet (1 orang)", "Tambahan Set-up & Layanan 1 Titik
   VIP Buffet". Kedudukannya sama dengan delivery; lihat catatan panjang di
   `MasukanTotal.biaya_tambahan` pada uang.ts.

   Penulisannya dikumpulkan di sini, dipakai penawaran maupun tagihan, karena
   satu sifatnya harus dipegang keduanya: MENIMPA, BUKAN MENAMBAH.

   Kalau barisnya hanya ditambahkan, menyimpan ulang satu dokumen akan
   menggandakan baris biayanya sementara grand_total-nya tetap dihitung dari
   formulir — jadi dokumen yang dikirim ke customer memuat rincian yang
   jumlahnya MELEBIHI angka yang ditagihkan. Totalnya tetap tampak wajar, jadi
   kesalahan seperti itu tidak ketahuan dari daftar invoice; yang menemukannya
   adalah customer yang menjumlahkan sendiri kolomnya.

   Menghapus lebih dulu — juga pada dokumen baru, yang belum punya baris apa
   pun — membuat fungsi ini aman dipanggil berapa kali pun. Satu kueri hapus
   beralas indeks pada dokumen baru jauh lebih murah daripada satu dokumen
   yang rinciannya tidak bisa dijelaskan.

   WAJIB dipanggil dengan `tx` bila berada di dalam transaksi: kolam koneksi
   hanya satu. Lihat catatan di lib/nomor.ts.
   ========================================================================== */

export type KlienBiayaTagihan = Pick<Prisma.TransactionClient, "invoice_charges">;
export type KlienBiayaPenawaran = Pick<Prisma.TransactionClient, "quotation_charges">;

export async function tulisBiayaTambahanTagihan(
  idTagihan: bigint,
  tambahan: BarisTambahanSiap[],
  klien: KlienBiayaTagihan,
): Promise<number> {
  await klien.invoice_charges.deleteMany({ where: { invoice_id: idTagihan } });
  if (tambahan.length === 0) return 0;

  const { count } = await klien.invoice_charges.createMany({
    data: tambahan.map((b) => ({
      invoice_id: idTagihan,
      label: b.label,
      amount: b.amount.toFixed(2),
      created_at: new Date(),
      updated_at: new Date(),
    })),
  });

  return count;
}

export async function tulisBiayaTambahanPenawaran(
  idPenawaran: bigint,
  tambahan: BarisTambahanSiap[],
  klien: KlienBiayaPenawaran,
): Promise<number> {
  await klien.quotation_charges.deleteMany({ where: { quotation_id: idPenawaran } });
  if (tambahan.length === 0) return 0;

  const { count } = await klien.quotation_charges.createMany({
    data: tambahan.map((b) => ({
      quotation_id: idPenawaran,
      label: b.label,
      amount: b.amount.toFixed(2),
      created_at: new Date(),
      updated_at: new Date(),
    })),
  });

  return count;
}
