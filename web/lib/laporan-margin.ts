import "server-only";

import type { Decimal } from "decimal.js";

import { namaPic } from "./kontak";
import { PENAWARAN_JADI_PERKIRAAN } from "./margin";
import { prisma } from "./prisma";
import { d, hitungMargin, type HasilMargin } from "./uang";

/* ==========================================================================
   LAPORAN MARGIN

   Dikumpulkan di sini karena dipakai DUA kali: layar dan berkas Excel yang
   diunduh. Rumus yang tersalin di dua tempat cepat atau lambat menyimpang,
   dan margin adalah angka yang dipakai memutuskan harga — menyimpang di situ
   berarti harga berikutnya disusun dari angka yang salah.

   Dua bagiannya tidak pernah dijumlahkan, di layar maupun di Excel. Untung
   perkiraan adalah uang yang belum tentu datang; menjumlahkannya dengan uang
   yang sudah ditagihkan menghasilkan angka yang tidak berarti apa-apa tetapi
   terlihat meyakinkan.
   ========================================================================== */

export type BarisNyata = {
  id: string;
  nomor: string;
  tanggal: Date;
  pelanggan: string;
  /** Null kalau dokumen maupun customernya tidak menyebut siapa pun. */
  pic: string | null;
  jenisAcara: string | null;
  penjualan: Decimal;
  biaya: Decimal;
  untung: Decimal;
  marginPersen: Decimal;
  rugi: boolean;
  adaBiaya: boolean;
  final: boolean;
};

export type BarisPerkiraan = {
  id: string;
  nomor: string;
  tanggal: Date;
  pelanggan: string;
  pic: string | null;
  jenisAcara: string | null;
  hasil: HasilMargin;
  adaBiaya: boolean;
};

export type Ringkasan = {
  penjualan: Decimal;
  biaya: Decimal;
  untung: Decimal;
  marginPersen: Decimal;
  belumDicatat: number;
};

function ringkas(
  penjualan: Decimal,
  biaya: Decimal,
  belumDicatat: number,
): Ringkasan {
  const untung = penjualan.minus(biaya);
  return {
    penjualan,
    biaya,
    untung,
    marginPersen: penjualan.gt(0)
      ? untung.dividedBy(penjualan).times(100).toDecimalPlaces(2)
      : d(0),
    belumDicatat,
  };
}

export async function ambilLaporanMargin(kunci: string) {
  const [tagihan, penawaran] = await Promise.all([
    prisma.invoices.findMany({
      where: {
        status: { not: "cancelled" },
        ...(kunci
          ? {
              OR: [
                { invoice_number: { contains: kunci, mode: "insensitive" } },
                { customers: { name: { contains: kunci, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { invoice_date: "desc" },
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        grand_total: true,
        event_type: true,
        contact_person: true,
        customers: { select: { name: true, pic_name: true } },
        invoice_margins: {
          select: {
            net_sales: true,
            total_cost: true,
            profit: true,
            margin_percent: true,
            profit_status: true,
            status: true,
          },
        },
        _count: { select: { invoice_costs: true } },
      },
    }),
    prisma.quotations.findMany({
      where: {
        ...PENAWARAN_JADI_PERKIRAAN,
        ...(kunci
          ? {
              OR: [
                { quotation_number: { contains: kunci, mode: "insensitive" } },
                { customers: { name: { contains: kunci, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { quotation_date: "desc" },
      select: {
        id: true,
        quotation_number: true,
        quotation_date: true,
        grand_total: true,
        event_type: true,
        status: true,
        contact_person: true,
        customers: { select: { name: true, pic_name: true } },
        quotation_costs: { select: { estimated_amount: true, actual_amount: true } },
      },
    }),
  ]);

  const nyata: BarisNyata[] = tagihan.map((t) => {
    const m = t.invoice_margins;
    return {
      id: t.id.toString(),
      nomor: t.invoice_number,
      tanggal: t.invoice_date,
      pelanggan: t.customers.name,
      pic: namaPic(t.contact_person, t.customers.pic_name),
      jenisAcara: t.event_type,
      penjualan: d(m?.net_sales ?? t.grand_total),
      biaya: d(m?.total_cost ?? 0),
      untung: d(m?.profit ?? t.grand_total),
      marginPersen: d(m?.margin_percent ?? 100),
      rugi: m?.profit_status === "rugi",
      adaBiaya: t._count.invoice_costs > 0,
      final: m?.status === "final",
    };
  });

  const perkiraan: BarisPerkiraan[] = penawaran.map((p) => ({
    id: p.id.toString(),
    nomor: p.quotation_number,
    tanggal: p.quotation_date,
    pelanggan: p.customers.name,
    pic: namaPic(p.contact_person, p.customers.pic_name),
    jenisAcara: p.event_type,
    hasil: hitungMargin({
      penjualan: p.grand_total.toString(),
      biaya: p.quotation_costs.map((b) => ({
        estimated_amount: b.estimated_amount?.toString() ?? null,
        actual_amount: b.actual_amount?.toString() ?? null,
      })),
    }),
    adaBiaya: p.quotation_costs.length > 0,
  }));

  return {
    nyata,
    perkiraan,
    ringkasanNyata: ringkas(
      nyata.reduce((j, b) => j.plus(b.penjualan), d(0)),
      nyata.reduce((j, b) => j.plus(b.biaya), d(0)),
      nyata.filter((b) => !b.adaBiaya).length,
    ),
    ringkasanPerkiraan: ringkas(
      perkiraan.reduce((j, b) => j.plus(b.hasil.net_sales), d(0)),
      perkiraan.reduce((j, b) => j.plus(b.hasil.total_cost), d(0)),
      perkiraan.filter((b) => !b.adaBiaya).length,
    ),
  };
}
