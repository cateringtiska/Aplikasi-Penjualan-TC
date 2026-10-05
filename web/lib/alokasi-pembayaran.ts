import type { Prisma } from "@prisma/client";
import type { Decimal } from "decimal.js";

import { d, hitungStatusInvoice, type StatusInvoice } from "./uang";

/* ==========================================================================
   ALOKASI SETORAN KE INVOICE

   Satu setoran menempel pada satu atau beberapa invoice, dan tiap invoice
   menyimpan saldo serta statusnya sendiri. Memasang dan melepas alokasi
   dikumpulkan di sini supaya mencatat, mengubah, dan menghapus pembayaran
   tidak bisa menyimpang satu sama lain.

   Dua kesalahan yang paling mungkin terjadi saat MENGUBAH pembayaran, dan
   keduanya tidak bergejala:

   1. ALOKASI DIPINDAHKAN KE INVOICE LAIN tanpa menghitung ulang invoice yang
      ditinggalkan. Ia tetap mengaku lunas atas uang yang sudah tidak ada di
      sana, lalu keluar dari daftar piutang — jadi tidak ada lagi yang
      menagihnya.

   2. ALOKASI LAMA TIDAK DILEPAS sebelum sisa dibaca. Sisa itu masih memuat
      uang dari pembayaran ini sendiri, sehingga menaikkan alokasinya satu
      rupiah pun ditolak sebagai "melebihi sisa".

   KEDUANYA DISELESAIKAN OLEH SATU LANGKAH: lepasAlokasi() menghapus baris
   alokasinya LALU menghitung ulang invoice yang terdampak. Sesudah itu,
   invoice yang ditinggalkan sudah benar dan sisa yang dibaca sudah bersih.

   SELURUHNYA WAJIB DI DALAM SATU TRANSAKSI, dan wajib memakai `tx`: kolam
   koneksi hanya satu. Lihat catatan di lib/nomor.ts.
   ========================================================================== */

/** Bagian klien Prisma yang dibutuhkan — sengaja sempit. */
export type KlienAlokasi = Pick<Prisma.TransactionClient, "payment_details" | "invoices">;

/**
 * Menjumlah ulang seluruh alokasi yang masuk ke satu invoice, lalu menetapkan
 * statusnya.
 *
 * Selalu dihitung dari NOL berdasarkan baris payment_details yang ada —
 * tidak pernah menambah atau mengurangi angka yang tersimpan. Itu yang
 * membuat satu fungsi ini benar untuk mencatat, mengubah, maupun menghapus.
 */
export async function hitungUlangTagihan(
  tx: KlienAlokasi,
  idTagihan: bigint,
): Promise<void> {
  const jumlah = await tx.payment_details.aggregate({
    where: { invoice_id: idTagihan },
    _sum: { amount_applied: true },
  });

  const tagihan = await tx.invoices.findUniqueOrThrow({
    where: { id: idTagihan },
    select: { status: true, grand_total: true, due_date: true },
  });

  const dibayar = d(jumlah._sum.amount_applied);

  await tx.invoices.update({
    where: { id: idTagihan },
    data: {
      paid_amount: dibayar.toFixed(2),
      status: hitungStatusInvoice({
        statusSekarang: tagihan.status as StatusInvoice,
        grandTotal: tagihan.grand_total.toString(),
        totalDibayar: dibayar,
        dueDate: tagihan.due_date,
      }),
      updated_at: new Date(),
    },
  });
}

/**
 * Melepas seluruh alokasi sebuah pembayaran, lalu menghitung ulang invoice
 * yang terdampak. Mengembalikan daftar invoice itu.
 *
 * Dipanggil SEBELUM sisa dibaca, supaya sisa yang terbaca tidak lagi memuat
 * uang dari pembayaran ini sendiri.
 */
export async function lepasAlokasi(
  tx: KlienAlokasi,
  idPembayaran: bigint,
): Promise<bigint[]> {
  const lama = await tx.payment_details.findMany({
    where: { payment_id: idPembayaran },
    select: { invoice_id: true },
  });

  const terdampak = [...new Set(lama.map((x) => x.invoice_id))];

  await tx.payment_details.deleteMany({ where: { payment_id: idPembayaran } });
  for (const id of terdampak) await hitungUlangTagihan(tx, id);

  return terdampak;
}

/**
 * Memasang alokasi baru, lalu menghitung ulang invoice yang menerimanya.
 *
 * HANYA invoice yang baru — invoice yang ditinggalkan sudah dibereskan oleh
 * lepasAlokasi(), yang memang harus dipanggil lebih dulu agar sisanya bisa
 * dibaca dengan benar. Fungsi ini sempat juga menghitung ulang daftar lama
 * "untuk berjaga-jaga"; dicoba dilepas, tidak satu tes pun gagal, karena
 * memang tidak mengerjakan apa pun. Yang tidak bisa dibuktikan perlu,
 * dibuang — bukan disimpan sebagai jaminan yang tidak pernah diuji.
 */
export async function pasangAlokasi(
  tx: KlienAlokasi,
  idPembayaran: bigint,
  alokasi: { invoice_id: bigint; jumlah: Decimal }[],
): Promise<void> {
  for (const a of alokasi) {
    await tx.payment_details.create({
      data: {
        payment_id: idPembayaran,
        invoice_id: a.invoice_id,
        amount_applied: a.jumlah.toFixed(2),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  for (const id of new Set(alokasi.map((a) => a.invoice_id))) {
    await hitungUlangTagihan(tx, id);
  }
}

/* -------------------------------------------------------------------------
   APA YANG HARUS SAMA DENGAN APA
   ------------------------------------------------------------------------- */

/**
 * Memeriksa bahwa alokasinya menutup persis sebanyak yang dibayarkan.
 *
 * Yang menutup invoice adalah UANG YANG DITERIMA DITAMBAH PPh 23 YANG
 * DIPOTONG. PPh 23 bukan uang yang hilang: customer menahannya lalu
 * menyetorkannya ke kas negara atas nama perusahaan, dan memberi bukti
 * potong. Invoicenya lunas sebesar nilai penuhnya.
 *
 * Menuntut alokasinya sama dengan uang yang diterima saja akan membuat
 * setiap pembayaran yang dipotong pajak mustahil dicatat — satu-satunya
 * jalan keluarnya adalah mencatat invoicenya kurang bayar, dan piutang itu
 * tidak akan pernah bisa ditagih kepada siapa pun.
 *
 * Mengembalikan kalimat galat, atau null kalau sudah cocok.
 */
export function cocokkanAlokasi(argumen: {
  diterima: Decimal;
  pph23: Decimal;
  totalAlokasi: Decimal;
}): string | null {
  const menutup = argumen.diterima.plus(argumen.pph23);
  if (argumen.totalAlokasi.equals(menutup)) return null;

  const rincian = argumen.pph23.gt(0)
    ? `uang yang diterima (${argumen.diterima.toFixed(0)}) ditambah PPh 23 (${argumen.pph23.toFixed(0)}) = ${menutup.toFixed(0)}`
    : `uang yang diterima (${argumen.diterima.toFixed(0)})`;

  return `Jumlah alokasi (${argumen.totalAlokasi.toFixed(0)}) harus sama persis dengan ${rincian}. Selisih ${menutup.minus(argumen.totalAlokasi).abs().toFixed(0)}.`;
}
