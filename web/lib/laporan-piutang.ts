import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { Decimal } from "decimal.js";

import { pengakuanDokumen } from "./pengakuan";
import { tanggalAcaraDokumen } from "./tanggal";
import { prisma } from "./prisma";
import type { SaringMilik } from "./rbac";
import { d } from "./uang";

/* ==========================================================================
   KARTU PIUTANG

   Perhitungannya dikumpulkan di sini karena dipakai DUA kali: sekali untuk
   layar, sekali untuk berkas Excel yang diunduh. Kalau rumusnya tersalin di
   dua tempat, cepat atau lambat keduanya menyimpang — dan yang menemukannya
   lebih dulu adalah orang yang sedang menagih dengan angka yang salah.
   ========================================================================== */

/**
 * Umur piutang.
 *
 * Pengelompokannya mengikuti kebiasaan penagihan: yang belum jatuh tempo,
 * lalu tiga kelompok keterlambatan. Kelompok 60+ hari adalah yang biasanya
 * perlu ditindaklanjuti secara khusus.
 */
export const KELOMPOK = [
  { kunci: "belum", label: "Belum jatuh tempo" },
  { kunci: "h1", label: "1–30 hari" },
  { kunci: "h31", label: "31–60 hari" },
  { kunci: "h60", label: "Lebih dari 60 hari" },
] as const;

export type KunciKelompok = (typeof KELOMPOK)[number]["kunci"];

export type BarisPiutang = {
  nama: string;
  kode: string;
  idPelanggan: string;
  jumlahTagihan: number;
  total: Decimal;
  /** Tanggal invoice PALING TUA yang masih menyisakan piutang. */
  tanggalTertua: Date;
  tempoTertua: Date;
  hariTerlambat: number;
};

/** Customer yang punya invoice tetapi tidak menyisakan piutang sama sekali. */
export type CustomerLunas = {
  id: string;
  nama: string;
  kode: string;
  jumlahInvoice: number;
  totalDibayar: Decimal;
};

export type HasilPiutang = {
  daftar: BarisPiutang[];
  umur: Record<KunciKelompok, Decimal>;
  totalSemua: Decimal;
  /**
   * Nilai yang BELUM menjadi piutang karena acaranya belum terjadi.
   *
   * Tidak ikut dijumlahkan ke piutang mana pun, tetapi tetap ditampilkan:
   * uangnya tetap harus ditagih, dan menghilangkannya dari layar membuat
   * orang mengira invoicenya tidak tercatat.
   */
  belumTerjadi: {
    jumlahInvoice: number;
    /** Panjar yang sudah masuk. Tumpang tindih dengan proyeksi. */
    uangMuka: Decimal;
    /** Nilai penuh dokumen yang sudah lunas di muka. */
    diterimaDiMuka: Decimal;
    /** Nilai dokumen yang belum dibayar sama sekali. */
    proyeksi: Decimal;
  };
  /**
   * Diisi HANYA ketika daftar piutangnya kosong.
   *
   * Mencari nama customer yang ternyata sudah lunas menghasilkan halaman
   * kosong, dan halaman kosong terbaca sebagai "pembayaran saya tidak
   * tercatat" — padahal justru sebaliknya. Daftar ini yang menjelaskannya,
   * sekaligus menunjukkan ke mana riwayatnya pergi.
   */
  lunas: CustomerLunas[];
};

export async function ambilPiutang(kunci: string, milik: SaringMilik): Promise<HasilPiutang> {
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  const tagihan = await prisma.invoices.findMany({
    where: {
      ...milik,
      // SELURUH invoice yang tidak dibatalkan, bukan hanya yang belum lunas.
      // Invoice yang sudah DILUNASI sebelum acaranya terjadi berstatus
      // "paid", dan menyaringnya di sini membuat pendapatan diterima di muka
      // selalu terbaca nol. Yang sudah tidak menyisakan apa pun tetap
      // dilewati di bawah.
      status: { not: "cancelled" },
      ...(kunci ? { customers: { name: { contains: kunci, mode: "insensitive" } } } : {}),
    },
    orderBy: { due_date: "asc" },
    select: {
      id: true,
      invoice_number: true,
      invoice_date: true,
      due_date: true,
      grand_total: true,
      paid_amount: true,
      customer_id: true,
      customers: { select: { id: true, name: true, customer_code: true } },
      // Kolom lamanya ikut diambil — lihat catatan di tanggalAcaraDokumen().
      event_date: true,
      event_days: true,
      invoice_event_dates: { select: { event_date: true } },
    },
  });

  // Dikelompokkan per pelanggan, karena penagihan dilakukan per pelanggan —
  // bukan per lembar tagihan.
  const perPelanggan = new Map<string, BarisPiutang>();

  const umur: Record<KunciKelompok, Decimal> = {
    belum: d(0),
    h1: d(0),
    h31: d(0),
    h60: d(0),
  };

  const belumTerjadi = {
    jumlahInvoice: 0,
    uangMuka: d(0),
    diterimaDiMuka: d(0),
    proyeksi: d(0),
  };

  for (const t of tagihan) {
    // PIUTANG HANYA DARI ACARA YANG SUDAH TERJADI. Menagih sesuatu yang
    // belum diserahkan bukan piutang, dan memasukkannya ke sini membuat umur
    // piutang terbaca jauh lebih buruk daripada keadaan sebenarnya.
    const pengakuan = pengakuanDokumen(
      {
        grand_total: t.grand_total,
        paid_amount: t.paid_amount,
        tanggalAcara: tanggalAcaraDokumen(t.invoice_event_dates, t.event_date, t.event_days),
      },
      hariIni,
    );

    if (!pengakuan.sudahTerjadi) {
      belumTerjadi.jumlahInvoice += 1;
      belumTerjadi.uangMuka = belumTerjadi.uangMuka.plus(pengakuan.uangMuka);
      belumTerjadi.diterimaDiMuka = belumTerjadi.diterimaDiMuka.plus(pengakuan.diterimaDiMuka);
      belumTerjadi.proyeksi = belumTerjadi.proyeksi.plus(pengakuan.proyeksi);
      continue;
    }

    const sisa = pengakuan.piutang;
    if (sisa.lte(0)) continue;

    const terlambat = differenceInCalendarDays(hariIni, t.due_date);
    const kelompok: KunciKelompok =
      terlambat <= 0 ? "belum" : terlambat <= 30 ? "h1" : terlambat <= 60 ? "h31" : "h60";
    umur[kelompok] = umur[kelompok].plus(sisa);

    const id = t.customer_id.toString();
    const ada = perPelanggan.get(id);

    if (ada) {
      ada.jumlahTagihan += 1;
      ada.total = ada.total.plus(sisa);
      // Tanggal invoice dan jatuh tempo dilacak TERPISAH. Invoice tertua
      // belum tentu yang jatuh temponya paling dulu — tempo bisa berbeda
      // per invoice, dan menurunkan keduanya dari satu baris yang sama akan
      // menampilkan pasangan tanggal yang tidak pernah ada.
      if (t.invoice_date < ada.tanggalTertua) ada.tanggalTertua = t.invoice_date;
      if (t.due_date < ada.tempoTertua) {
        ada.tempoTertua = t.due_date;
        ada.hariTerlambat = Math.max(0, terlambat);
      }
    } else {
      perPelanggan.set(id, {
        nama: t.customers.name,
        kode: t.customers.customer_code,
        idPelanggan: id,
        jumlahTagihan: 1,
        total: sisa,
        tanggalTertua: t.invoice_date,
        tempoTertua: t.due_date,
        hariTerlambat: Math.max(0, terlambat),
      });
    }
  }

  const daftar = [...perPelanggan.values()].sort((a, b) => b.total.comparedTo(a.total));
  const totalSemua = daftar.reduce((jumlah, p) => jumlah.plus(p.total), d(0));

  // Kueri tambahan ini hanya dijalankan saat tidak ada piutang sama sekali,
  // jadi tidak membebani pemakaian sehari-hari.
  const lunas = daftar.length === 0 ? await customerYangSudahLunas(kunci) : [];

  return { daftar, umur, totalSemua, belumTerjadi, lunas };
}

async function customerYangSudahLunas(kunci: string): Promise<CustomerLunas[]> {
  const pelanggan = await prisma.customers.findMany({
    where: {
      ...(kunci ? { name: { contains: kunci, mode: "insensitive" } } : {}),
      // Yang belum pernah ditagih sama sekali bukan "sudah lunas" — ia hanya
      // belum punya transaksi, dan menyebutnya lunas akan menyesatkan.
      invoices: { some: { status: { not: "cancelled" } } },
    },
    orderBy: { name: "asc" },
    take: 25,
    select: {
      id: true,
      name: true,
      customer_code: true,
      invoices: {
        where: { status: { not: "cancelled" } },
        select: { grand_total: true, paid_amount: true },
      },
    },
  });

  const hasil: CustomerLunas[] = [];

  for (const p of pelanggan) {
    const sisa = p.invoices.reduce(
      (j, i) => j.plus(d(i.grand_total)).minus(d(i.paid_amount)),
      d(0),
    );
    if (sisa.gt(0)) continue;

    hasil.push({
      id: p.id.toString(),
      nama: p.name,
      kode: p.customer_code,
      jumlahInvoice: p.invoices.length,
      totalDibayar: p.invoices.reduce((j, i) => j.plus(d(i.paid_amount)), d(0)),
    });
  }

  return hasil;
}
