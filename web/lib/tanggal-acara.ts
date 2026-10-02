import type { Prisma } from "@prisma/client";

/* ==========================================================================
   MENULIS TANGGAL ACARA SEBUAH DOKUMEN

   Sifatnya sama dengan biaya tambahan: MENIMPA, BUKAN MENAMBAH. Lihat
   catatan panjang di lib/biaya-tambahan.ts — alasannya persis sama, hanya
   akibatnya yang berbeda. Di sini, baris yang menumpuk membuat "jumlah hari"
   terbaca lebih banyak daripada hari yang benar-benar terjadi, dan angka itu
   ikut tercetak di dokumen yang dikirim ke customer.

   WAJIB dipanggil dengan `tx` bila berada di dalam transaksi: kolam koneksi
   hanya satu. Lihat catatan di lib/nomor.ts.
   ========================================================================== */

export type KlienTanggalTagihan = Pick<Prisma.TransactionClient, "invoice_event_dates">;
export type KlienTanggalPenawaran = Pick<Prisma.TransactionClient, "quotation_event_dates">;

export async function tulisTanggalAcaraTagihan(
  idTagihan: bigint,
  tanggal: Date[],
  klien: KlienTanggalTagihan,
): Promise<number> {
  await klien.invoice_event_dates.deleteMany({ where: { invoice_id: idTagihan } });
  if (tanggal.length === 0) return 0;

  const { count } = await klien.invoice_event_dates.createMany({
    data: tanggal.map((t) => ({
      invoice_id: idTagihan,
      event_date: t,
      created_at: new Date(),
      updated_at: new Date(),
    })),
  });

  return count;
}

export async function tulisTanggalAcaraPenawaran(
  idPenawaran: bigint,
  tanggal: Date[],
  klien: KlienTanggalPenawaran,
): Promise<number> {
  await klien.quotation_event_dates.deleteMany({ where: { quotation_id: idPenawaran } });
  if (tanggal.length === 0) return 0;

  const { count } = await klien.quotation_event_dates.createMany({
    data: tanggal.map((t) => ({
      quotation_id: idPenawaran,
      event_date: t,
      created_at: new Date(),
      updated_at: new Date(),
    })),
  });

  return count;
}
