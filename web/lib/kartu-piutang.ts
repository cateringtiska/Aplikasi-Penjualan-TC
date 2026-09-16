import "server-only";

import type { Decimal } from "decimal.js";

import { prisma } from "./prisma";
import { d } from "./uang";

/* ==========================================================================
   KARTU PIUTANG PER CUSTOMER

   Berbeda dari halaman "Kartu Piutang" di menu Laporan, yang sebenarnya
   adalah daftar UMUR piutang: di sana hanya yang masih berutang yang tampil,
   dan itu memang benar — invoice yang sudah lunas tidak punya umur
   keterlambatan, jadi memasukkannya akan merusak arti kelompok "31–60 hari".

   Yang di sini adalah kartu dalam arti pembukuan: seluruh mutasi satu
   customer berurutan waktu, dengan saldo berjalan. Invoice menambah piutang,
   pembayaran menguranginya, dan yang sudah lunas TETAP terlihat. Inilah yang
   dibuka ketika catatan Anda dan catatan customer berselisih.

   Satu baris per ALOKASI pembayaran, bukan per setoran. Satu setoran bisa
   menutup beberapa invoice sekaligus; yang perlu diketahui saat menelusuri
   selisih adalah setoran mana menutup invoice mana.

   Invoice yang dibatalkan tidak ikut: ia tidak pernah menjadi piutang.
   ========================================================================== */

export type BarisKartu = {
  kunci: string;
  tanggal: Date;
  jenis: "invoice" | "pembayaran";
  nomor: string;
  /** Alamat dokumen asalnya, supaya barisnya bisa ditelusuri. */
  tautan: string;
  keterangan: string | null;
  debit: Decimal;
  kredit: Decimal;
  /** Saldo piutang SETELAH baris ini. */
  saldo: Decimal;
};

export type KartuPiutang = {
  customer: {
    id: string;
    nama: string;
    kode: string;
    alamat: string | null;
    telepon: string | null;
    pic: string | null;
  };
  baris: BarisKartu[];
  totalInvoice: Decimal;
  totalBayar: Decimal;
  sisa: Decimal;
};

export async function ambilKartuPiutang(id: string): Promise<KartuPiutang | null> {
  const idPelanggan = BigInt(id);

  const [pelanggan, invoice, alokasi] = await Promise.all([
    prisma.customers.findUnique({
      where: { id: idPelanggan },
      select: {
        id: true,
        name: true,
        customer_code: true,
        address: true,
        phone: true,
        pic_name: true,
      },
    }),
    prisma.invoices.findMany({
      where: { customer_id: idPelanggan, status: { not: "cancelled" } },
      orderBy: { invoice_date: "asc" },
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        grand_total: true,
        event_type: true,
      },
    }),
    prisma.payment_details.findMany({
      where: { payments: { customer_id: idPelanggan } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        amount_applied: true,
        invoices: { select: { invoice_number: true } },
        payments: {
          select: { id: true, payment_number: true, payment_date: true, payment_method: true },
        },
      },
    }),
  ]);

  if (!pelanggan) return null;

  const mutasi: Omit<BarisKartu, "saldo">[] = [
    ...invoice.map((t) => ({
      kunci: `inv-${t.id}`,
      tanggal: t.invoice_date,
      jenis: "invoice" as const,
      nomor: t.invoice_number,
      tautan: `/tagihan/${t.id}`,
      keterangan: t.event_type,
      debit: d(t.grand_total),
      kredit: d(0),
    })),
    ...alokasi.map((a) => ({
      kunci: `bayar-${a.id}`,
      tanggal: a.payments.payment_date,
      jenis: "pembayaran" as const,
      nomor: a.payments.payment_number,
      tautan: `/pembayaran/${a.payments.id}`,
      keterangan: `untuk ${a.invoices.invoice_number}`,
      debit: d(0),
      kredit: d(a.amount_applied),
    })),
  ];

  // Urut waktu. Pada tanggal yang sama, invoice didahulukan: piutangnya harus
  // sudah ada sebelum pembayarannya mengurangi — kalau terbalik, saldo
  // berjalannya sempat terbaca minus pada hari itu.
  mutasi.sort((a, b) => {
    const selisih = a.tanggal.getTime() - b.tanggal.getTime();
    if (selisih !== 0) return selisih;
    if (a.jenis !== b.jenis) return a.jenis === "invoice" ? -1 : 1;
    return a.kunci.localeCompare(b.kunci);
  });

  let saldo = d(0);
  const baris: BarisKartu[] = mutasi.map((m) => {
    saldo = saldo.plus(m.debit).minus(m.kredit);
    return { ...m, saldo };
  });

  const totalInvoice = baris.reduce((j, b) => j.plus(b.debit), d(0));
  const totalBayar = baris.reduce((j, b) => j.plus(b.kredit), d(0));

  return {
    customer: {
      id: pelanggan.id.toString(),
      nama: pelanggan.name,
      kode: pelanggan.customer_code,
      alamat: pelanggan.address,
      telepon: pelanggan.phone,
      pic: pelanggan.pic_name,
    },
    baris,
    totalInvoice,
    totalBayar,
    sisa: totalInvoice.minus(totalBayar),
  };
}
