import "server-only";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type ExcelJS from "exceljs";

import { d } from "./uang";

/* ==========================================================================
   LEMBAR "RINCIAN ITEM" — LAPORAN PENJUALAN GAYA BUKU BESAR

   Bentuknya meniru laporan bulanan yang dulu disusun tangan di Excel: satu
   blok per invoice, setiap item satu baris, lalu baris subtotal. Lembar ini
   untuk DIBACA (siapa menjual apa ke siapa), sementara lembar-lembar per
   keadaan pengakuan tetap untuk menjurnal.

   Service charge, PB1, delivery, dan biaya tambahan ikut dicetak sebagai
   baris sendiri, sehingga SUBTOTAL SETIAP BLOK = TOTAL INVOICE dan grand
   total di bawah sama dengan total lembar lainnya.
   ========================================================================== */

export type InvoiceRincian = {
  nomor: string;
  tanggal: Date;
  sales: string;
  pelanggan: string;
  items: { nama: string; qty: string; harga: string; total: string }[];
  serviceCharge: string;
  pb1: string;
  delivery: string;
  biayaTambahan: { label: string; nilai: string }[];
  total: string;
};

type Baris = { uraian: string; qty: number; harga: number; total: number };

/** Semua baris satu invoice: item dulu, lalu pos-pos di luar item. */
export function barisRincian(inv: InvoiceRincian): Baris[] {
  const hasil: Baris[] = inv.items.map((i) => ({
    uraian: i.nama,
    qty: Number(i.qty),
    harga: Number(i.harga),
    total: Number(i.total),
  }));

  const pos = (uraian: string, nilai: string) => {
    if (d(nilai).isZero()) return;
    hasil.push({ uraian, qty: 1, harga: Number(nilai), total: Number(nilai) });
  };
  pos("Service Charge", inv.serviceCharge);
  pos("PB1", inv.pb1);
  pos("Delivery Service", inv.delivery);
  for (const b of inv.biayaTambahan) pos(b.label, b.nilai);

  // Invoice tanpa baris sama sekali tetap tampil satu baris, supaya nomor
  // urut dan subtotalnya tidak hilang.
  if (hasil.length === 0) hasil.push({ uraian: "-", qty: 0, harga: 0, total: 0 });
  return hasil;
}

const UNGU_TUA = "FF614B79";
const UNGU_MUDA = "FFB4A5CB";
const EMAS = "FFD9B65C";
const HIJAU_MUDA = "FFEBF1DE";
const BIRU_MUDA = "FFE8EEF7";
const GARIS = "FFBFBFBF";

const FORMAT_UANG = '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp -"';
const FORMAT_QTY = '#,##0.##;-#,##0.##;""';

const KOLOM = [
  { judul: "No", lebar: 6 },
  { judul: "Sales", lebar: 12 },
  { judul: "Tgl. Invoice", lebar: 18 },
  { judul: "No. Invoice", lebar: 17 },
  { judul: "Konsumen", lebar: 32 },
  { judul: "Uraian / Item", lebar: 42 },
  { judul: "Qty", lebar: 8 },
  { judul: "Harga Satuan (Rp)", lebar: 18 },
  { judul: "Total (Rp)", lebar: 18 },
];
const N = KOLOM.length;
const HURUF_AKHIR = String.fromCharCode(64 + N);

const garis: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: GARIS } },
  bottom: { style: "thin", color: { argb: GARIS } },
  left: { style: "thin", color: { argb: GARIS } },
  right: { style: "thin", color: { argb: GARIS } },
};

const isi = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

export function tambahLembarRincian(
  buku: ExcelJS.Workbook,
  argumen: { invoices: InvoiceRincian[]; namaPerusahaan: string; periode: string },
): ExcelJS.Worksheet {
  const lembar = buku.addWorksheet("Rincian Item", {
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  KOLOM.forEach((k, i) => (lembar.getColumn(i + 1).width = k.lebar));

  // ---------- Judul ----------
  const judul: [string, Partial<ExcelJS.Font>][] = [
    [`LAPORAN PENJUALAN ${argumen.namaPerusahaan}`.toUpperCase(), { bold: true, size: 16, color: { argb: "FFFFFFFF" } }],
    ["LAPORAN PENJUALAN", { size: 11, color: { argb: EMAS } }],
    [argumen.periode.toUpperCase(), { bold: true, size: 12, color: { argb: "FFFFFFFF" } }],
  ];
  judul.forEach(([teks, font], i) => {
    const r = i + 1;
    lembar.mergeCells(`A${r}:${HURUF_AKHIR}${r}`);
    const sel = lembar.getCell(`A${r}`);
    sel.value = teks;
    sel.font = font;
    sel.fill = isi(UNGU_TUA);
    sel.alignment = { horizontal: "center", vertical: "middle" };
    lembar.getRow(r).height = i === 0 ? 26 : 18;
  });

  // ---------- Kepala tabel ----------
  const RK = 5;
  const kepala = lembar.getRow(RK);
  kepala.values = KOLOM.map((k) => k.judul);
  kepala.height = 30;
  for (let c = 1; c <= N; c++) {
    const sel = kepala.getCell(c);
    sel.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sel.fill = isi(UNGU_MUDA);
    sel.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sel.border = garis;
  }

  // ---------- Blok per invoice ----------
  let r = RK + 1;
  let grandTotal = d(0);

  argumen.invoices.forEach((inv, urut) => {
    const daftar = barisRincian(inv);
    const awal = r;

    daftar.forEach((b, i) => {
      const baris = lembar.getRow(r);
      baris.values = [
        i === 0 ? urut + 1 : null,
        inv.sales,
        i === 0 ? format(inv.tanggal, "dd MMMM yyyy", { locale: localeId }) : null,
        i === 0 ? inv.nomor : null,
        i === 0 ? inv.pelanggan : null,
        b.uraian,
        b.qty || null,
        b.harga,
        b.total,
      ];
      for (let c = 1; c <= N; c++) {
        const sel = baris.getCell(c);
        sel.fill = isi(HIJAU_MUDA);
        sel.border = garis;
        sel.alignment = { vertical: "middle", wrapText: c === 5 || c === 6 };
      }
      baris.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      baris.getCell(1).font = { bold: true };
      baris.getCell(2).font = { bold: true };
      baris.getCell(5).font = { bold: true };
      baris.getCell(7).numFmt = FORMAT_QTY;
      baris.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      baris.getCell(8).numFmt = FORMAT_UANG;
      baris.getCell(9).numFmt = FORMAT_UANG;
      r++;
    });

    // No, tanggal, nomor, dan konsumen digabung setinggi bloknya.
    if (r - 1 > awal) {
      for (const c of ["A", "C", "D", "E"]) lembar.mergeCells(`${c}${awal}:${c}${r - 1}`);
    }

    const sub = lembar.getRow(r);
    lembar.mergeCells(`A${r}:G${r}`);
    sub.getCell(8).value = "Subtotal";
    sub.getCell(9).value = Number(inv.total);
    sub.getCell(9).numFmt = FORMAT_UANG;
    for (let c = 1; c <= N; c++) {
      sub.getCell(c).fill = isi(BIRU_MUDA);
      sub.getCell(c).border = garis;
    }
    sub.getCell(8).font = { bold: true };
    sub.getCell(8).alignment = { horizontal: "right" };
    sub.getCell(9).font = { bold: true };
    r++;

    grandTotal = grandTotal.plus(d(inv.total));
  });

  // ---------- Grand total ----------
  const akhir = lembar.getRow(r);
  lembar.mergeCells(`A${r}:G${r}`);
  akhir.getCell(1).value = `${argumen.invoices.length} invoice`;
  akhir.getCell(8).value = "GRAND TOTAL";
  akhir.getCell(9).value = Number(grandTotal);
  akhir.getCell(9).numFmt = FORMAT_UANG;
  akhir.height = 22;
  for (let c = 1; c <= N; c++) {
    akhir.getCell(c).fill = isi(UNGU_TUA);
    akhir.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } };
    akhir.getCell(c).alignment = { vertical: "middle", horizontal: c === 8 ? "right" : undefined };
  }

  lembar.views = [{ state: "frozen", ySplit: RK }];
  lembar.autoFilter = { from: { row: RK, column: 1 }, to: { row: RK, column: N } };

  return lembar;
}

/** "BULAN AGUSTUS 2026" kalau rentangnya tepat satu bulan, selain itu periodenya apa adanya. */
export function judulBulan(dari: string, sampai: string, cadangan: string): string {
  if (!dari || !sampai) return cadangan;
  const a = new Date(dari);
  const b = new Date(sampai);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return cadangan;
  const awalBulan = a.getUTCDate() === 1;
  const akhirBulan = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0)).getUTCDate() === b.getUTCDate();
  const bulanSama = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  if (awalBulan && akhirBulan && bulanSama) {
    return `Bulan ${format(a, "MMMM yyyy", { locale: localeId })}`;
  }
  return `Periode ${format(a, "d MMM yyyy", { locale: localeId })} – ${format(b, "d MMM yyyy", { locale: localeId })}`;
}
