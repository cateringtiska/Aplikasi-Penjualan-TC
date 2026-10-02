import "server-only";

import { prisma } from "@/lib/prisma";
import type { SaringMilik } from "@/lib/rbac";
import { d, labelStatusInvoice } from "@/lib/uang";

/* ==========================================================================
   KUERI LAPORAN PENJUALAN

   Dipakai bersama oleh halaman, ekspor Excel, dan versi cetak. Kalau
   ketiganya punya kueri sendiri-sendiri, cepat atau lambat angkanya akan
   berbeda dan tidak ada yang tahu mana yang benar.
   ========================================================================== */

export type SaringLaporan = {
  dari: string;
  sampai: string;
  pelanggan: string;
};

export function bacaSaring(params: Record<string, string | string[] | undefined>): SaringLaporan {
  const ambil = (kunci: string) => {
    const nilai = params[kunci];
    return typeof nilai === "string" ? nilai.trim() : "";
  };
  return { dari: ambil("dari"), sampai: ambil("sampai"), pelanggan: ambil("customer") };
}

function kondisiTanggal(saring: SaringLaporan) {
  const rentang: { gte?: Date; lte?: Date } = {};
  if (saring.dari) rentang.gte = new Date(saring.dari);
  if (saring.sampai) rentang.lte = new Date(saring.sampai);
  return Object.keys(rentang).length > 0 ? rentang : undefined;
}

export async function ambilLaporan(saring: SaringLaporan, milik: SaringMilik) {
  const tanggal = kondisiTanggal(saring);
  const pelangganId = saring.pelanggan ? BigInt(saring.pelanggan) : undefined;

  const [tagihan, penawaran, daftarPelanggan] = await Promise.all([
    prisma.invoices.findMany({
      where: {
        ...milik,
        ...(tanggal ? { invoice_date: tanggal } : {}),
        ...(pelangganId ? { customer_id: pelangganId } : {}),
      },
      orderBy: { invoice_date: "desc" },
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        due_date: true,
        grand_total: true,
        paid_amount: true,
        status: true,
        event_type: true,
        customers: { select: { name: true } },
      },
    }),
    prisma.quotations.findMany({
      where: {
        ...milik,
        ...(tanggal ? { quotation_date: tanggal } : {}),
        ...(pelangganId ? { customer_id: pelangganId } : {}),
      },
      select: { status: true, grand_total: true },
    }),
    prisma.customers.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const aktif = tagihan.filter((t) => t.status !== "cancelled");

  const baris = tagihan.map((t) => ({
    id: t.id.toString(),
    nomor: t.invoice_number,
    tanggal: t.invoice_date,
    jatuhTempo: t.due_date,
    pelanggan: t.customers.name,
    acara: t.event_type ?? "",
    total: t.grand_total.toString(),
    dibayar: t.paid_amount.toString(),
    sisa: d(t.grand_total).minus(d(t.paid_amount)).toString(),
    status: t.status,
    statusLabel: labelStatusInvoice(t.status, t.paid_amount.toString()),
  }));

  return {
    baris,
    pelanggan: daftarPelanggan.map((p) => ({ id: p.id.toString(), nama: p.name })),
    ringkasan: {
      jumlahPenawaran: penawaran.length,
      nilaiPenawaran: penawaran.reduce((j, q) => j.plus(d(q.grand_total)), d(0)),
      penawaranDisetujui: penawaran.filter((q) => q.status === "approved").length,

      jumlahTagihan: aktif.length,
      nilaiTagihan: aktif.reduce((j, t) => j.plus(d(t.grand_total)), d(0)),
      totalTerbayar: aktif.reduce((j, t) => j.plus(d(t.paid_amount)), d(0)),
      totalPiutang: aktif.reduce(
        (j, t) => j.plus(d(t.grand_total).minus(d(t.paid_amount))),
        d(0),
      ),
      jumlahJatuhTempo: aktif.filter((t) => t.status === "overdue").length,
    },
  };
}

/** Judul rentang untuk dicetak: "1 Sep 2026 – 30 Sep 2026" atau "Semua periode". */
export function judulPeriode(saring: SaringLaporan): string {
  if (!saring.dari && !saring.sampai) return "Semua periode";
  if (saring.dari && !saring.sampai) return `Sejak ${saring.dari}`;
  if (!saring.dari && saring.sampai) return `Sampai ${saring.sampai}`;
  return `${saring.dari} sampai ${saring.sampai}`;
}
