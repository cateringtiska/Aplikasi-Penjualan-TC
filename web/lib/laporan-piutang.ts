import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { Decimal } from "decimal.js";

import { prisma } from "./prisma";
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
  tempoTertua: Date;
  hariTerlambat: number;
};

export type HasilPiutang = {
  daftar: BarisPiutang[];
  umur: Record<KunciKelompok, Decimal>;
  totalSemua: Decimal;
};

export async function ambilPiutang(kunci: string): Promise<HasilPiutang> {
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  const tagihan = await prisma.invoices.findMany({
    where: {
      status: { in: ["unpaid", "partial", "overdue"] },
      ...(kunci ? { customers: { name: { contains: kunci, mode: "insensitive" } } } : {}),
    },
    orderBy: { due_date: "asc" },
    select: {
      id: true,
      invoice_number: true,
      due_date: true,
      grand_total: true,
      paid_amount: true,
      customer_id: true,
      customers: { select: { id: true, name: true, customer_code: true } },
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

  for (const t of tagihan) {
    const sisa = d(t.grand_total).minus(d(t.paid_amount));
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
        tempoTertua: t.due_date,
        hariTerlambat: Math.max(0, terlambat),
      });
    }
  }

  const daftar = [...perPelanggan.values()].sort((a, b) => b.total.comparedTo(a.total));
  const totalSemua = daftar.reduce((jumlah, p) => jumlah.plus(p.total), d(0));

  return { daftar, umur, totalSemua };
}
