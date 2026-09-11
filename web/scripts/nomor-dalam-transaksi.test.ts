import { afterAll, describe, expect, it } from "vitest";

import { nomorDokumenBerikutnya } from "../lib/nomor";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   PENOMORAN HARUS MENUMPANG KONEKSI TRANSAKSI

   Tes ini lahir dari kegagalan sungguhan: setiap penawaran, tagihan, dan
   pembayaran BARU gagal disimpan di produksi, dengan pesan yang tidak
   menjelaskan apa pun — "Tagihan gagal disimpan. Tidak ada data yang berubah."

   Sebabnya: nomor dokumen dicari lewat klien global, padahal pencariannya
   terjadi DI DALAM transaksi. Kolam koneksi aplikasi ini hanya satu koneksi
   per salinan fungsi, dan koneksi itu sedang dipegang transaksinya sendiri.
   Kueri nomor jadi mengantre menunggu koneksi yang tidak akan pernah bebas
   sebelum transaksinya selesai. Antrenya lewat lima detik, batas waktu
   transaksi Prisma terlampaui, dan commit-nya ditolak:

       A commit cannot be executed on an expired transaction.

   Panjang pesannya 277 karakter — di atas ambang 250 yang dipakai untuk
   memutuskan pesan mana yang layak ditampilkan — sehingga yang sampai ke
   layar hanya kalimat umum tadi.

   Yang dikunci di sini: penomoran di dalam transaksi selesai cepat dan
   transaksinya benar-benar commit. Kembalikan `tx` menjadi klien global di
   lib/nomor.ts, dan tes ini gagal persis seperti produksi kemarin.
   ========================================================================== */

const TANDA = "UJI NOMOR";
const dibuat: bigint[] = [];

afterAll(async () => {
  for (const id of dibuat) {
    await prisma.customers.delete({ where: { id } }).catch(() => {});
  }
  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);
  await prisma.$disconnect();
});

describe("penomoran di dalam transaksi", () => {
  it("selesai tanpa melewati batas waktu transaksi", async () => {
    const mulai = Date.now();

    const nomor = await prisma.$transaction(async (tx) => {
      // Satu kueri lebih dulu, supaya transaksinya benar-benar sudah
      // memegang koneksi ketika nomor dicari — sama seperti alur aslinya,
      // yang memeriksa dokumen lama sebelum membuat yang baru.
      await tx.invoices.count();
      return nomorDokumenBerikutnya("invoices", "invoice_number", "INV", tx);
    });

    expect(nomor).toMatch(/^INV-\d{4}-\d{4}$/);
    // Lima detik adalah batas waktu bawaan transaksi Prisma. Kalau pencarian
    // nomor sampai mengantre, angka ini melewatinya dan transaksinya mati.
    expect(Date.now() - mulai).toBeLessThan(5_000);
  });

  it("menyimpan baris baru bernomor dalam satu transaksi, dan commit-nya jadi", async () => {
    const pelanggan = await prisma.$transaction(async (tx) => {
      await tx.customers.count();
      const nomor = await nomorDokumenBerikutnya("invoices", "invoice_number", "INV", tx);

      return tx.customers.create({
        data: {
          customer_code: `UJI-${Date.now().toString().slice(-6)}`,
          name: `${TANDA} ${nomor}`,
          address: "Jl. Uji Coba No. 2",
          status: "active",
          created_at: new Date(),
          updated_at: new Date(),
        },
        select: { id: true, name: true },
      });
    });

    dibuat.push(pelanggan.id);

    // Dibaca ulang dari luar transaksi: bukti commit-nya benar-benar jadi,
    // bukan sekadar transaksinya tidak melempar galat.
    const tersimpan = await prisma.customers.findUnique({
      where: { id: pelanggan.id },
      select: { name: true },
    });
    expect(tersimpan?.name).toBe(pelanggan.name);
  });
});
