import { format } from "date-fns";
import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { sesiSekarang } from "@/lib/auth";

import { ambilLaporan, bacaSaring, judulPeriode } from "@/lib/laporan-penjualan";

export const dynamic = "force-dynamic";

/**
 * Mengunduh laporan penjualan sebagai berkas Excel.
 *
 * Kolomnya sengaja sama persis dengan ekspor Laravel, supaya berkas lama dan
 * baru bisa ditumpuk di satu lembar kerja tanpa menyesuaikan apa pun.
 *
 * Nilai uang ditulis sebagai ANGKA, bukan teks — supaya bisa dijumlah langsung
 * di Excel. Formatnya diberi pemisah ribuan gaya Indonesia.
 */
export async function GET(request: NextRequest) {
  const sesi = await sesiSekarang();
  if (!sesi) {
    return NextResponse.json({ pesan: "Silakan masuk lebih dulu." }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const saring = bacaSaring(params);
  const { baris, ringkasan } = await ambilLaporan(saring);

  const buku = new ExcelJS.Workbook();
  buku.creator = "Penjualan TC";
  buku.created = new Date();

  const lembar = buku.addWorksheet("Laporan Penjualan", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  lembar.mergeCells("A1:H1");
  lembar.getCell("A1").value = "Laporan Penjualan";
  lembar.getCell("A1").font = { bold: true, size: 14 };

  lembar.mergeCells("A2:H2");
  lembar.getCell("A2").value = `Periode: ${judulPeriode(saring)}`;
  lembar.getCell("A2").font = { color: { argb: "FF666666" } };

  const KEPALA = [
    "No. Invoice",
    "Tanggal",
    "Customer",
    "Jatuh Tempo",
    "Total",
    "Terbayar",
    "Sisa",
    "Status",
  ];

  const barisKepala = lembar.getRow(4);
  barisKepala.values = KEPALA;
  barisKepala.font = { bold: true };
  barisKepala.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F0F0" },
  };
  barisKepala.border = { bottom: { style: "thin", color: { argb: "FF999999" } } };

  for (const b of baris) {
    lembar.addRow([
      b.nomor,
      format(b.tanggal, "dd/MM/yyyy"),
      b.pelanggan,
      format(b.jatuhTempo, "dd/MM/yyyy"),
      Number(b.total),
      Number(b.dibayar),
      Number(b.sisa),
      b.statusLabel,
    ]);
  }

  // Baris total di bawah, supaya angkanya bisa langsung dibandingkan dengan
  // ringkasan di layar.
  const barisTotal = lembar.addRow([
    "TOTAL",
    "",
    "",
    "",
    Number(ringkasan.nilaiTagihan),
    Number(ringkasan.totalTerbayar),
    Number(ringkasan.totalPiutang),
    `${ringkasan.jumlahTagihan} tagihan aktif`,
  ]);
  barisTotal.font = { bold: true };
  barisTotal.border = { top: { style: "thin", color: { argb: "FF999999" } } };

  const lebar = [16, 12, 34, 12, 16, 16, 16, 24];
  lebar.forEach((w, i) => {
    lembar.getColumn(i + 1).width = w;
  });

  for (const kolom of [5, 6, 7]) {
    lembar.getColumn(kolom).numFmt = "#,##0";
    lembar.getColumn(kolom).alignment = { horizontal: "right" };
  }

  const isi = await buku.xlsx.writeBuffer();
  const namaBerkas = `laporan-penjualan-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;

  return new NextResponse(isi as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
