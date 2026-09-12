import { format } from "date-fns";
import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { penggunaAktif } from "@/lib/auth";
import { ambilLaporanMargin } from "@/lib/laporan-margin";

export const dynamic = "force-dynamic";

/**
 * Mengunduh laporan margin sebagai berkas Excel.
 *
 * DUA LEMBAR, bukan satu. Angka nyata dari tagihan dan angka perkiraan dari
 * quotation dipisah persis seperti di layar, supaya tidak ada yang tanpa
 * sengaja menyorot keduanya lalu menjumlahkannya di Excel. Untung perkiraan
 * adalah uang yang belum tentu datang; menjumlahkannya dengan uang yang sudah
 * ditagihkan menghasilkan angka yang tidak berarti apa-apa tetapi terlihat
 * meyakinkan — dan itu jenis angka yang paling berbahaya di laporan keuangan.
 *
 * Nilai uang ditulis sebagai ANGKA, bukan teks, supaya bisa langsung dijumlah.
 */
export async function GET(request: NextRequest) {
  // Dibaca ulang dari database, bukan dari cookie: margin memperlihatkan
  // seluruh struktur biaya, jadi pengguna yang sudah dinonaktifkan atau
  // diturunkan perannya tidak boleh masih bisa mengunduhnya.
  const sesi = await penggunaAktif();
  if (!sesi) {
    return NextResponse.json({ pesan: "Silakan masuk lebih dulu." }, { status: 401 });
  }
  if (!["admin", "finance"].includes(sesi.peran)) {
    return NextResponse.json({ pesan: "Anda tidak punya akses." }, { status: 403 });
  }

  const cari = request.nextUrl.searchParams.get("cari")?.trim() ?? "";
  const { nyata, perkiraan, ringkasanNyata, ringkasanPerkiraan } =
    await ambilLaporanMargin(cari);

  const buku = new ExcelJS.Workbook();
  buku.creator = "Penjualan TC";
  buku.created = new Date();

  const keterangan = `Per ${format(new Date(), "dd/MM/yyyy HH:mm")}${
    cari ? ` · pencarian: "${cari}"` : ""
  }`;

  /** Kepala lembar yang sama untuk kedua bagian. */
  function siapkanLembar(nama: string, judul: string, catatan: string) {
    const lembar = buku.addWorksheet(nama, { views: [{ state: "frozen", ySplit: 7 }] });

    lembar.mergeCells("A1:G1");
    lembar.getCell("A1").value = judul;
    lembar.getCell("A1").font = { bold: true, size: 14 };

    lembar.mergeCells("A2:G2");
    lembar.getCell("A2").value = keterangan;
    lembar.getCell("A2").font = { color: { argb: "FF666666" } };

    lembar.mergeCells("A3:G3");
    lembar.getCell("A3").value = catatan;
    lembar.getCell("A3").font = { italic: true, color: { argb: "FF666666" } };

    return lembar;
  }

  function tulisKepala(lembar: ExcelJS.Worksheet, kepala: string[]) {
    const baris = lembar.getRow(7);
    baris.values = kepala;
    baris.font = { bold: true };
    baris.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    baris.border = { bottom: { style: "thin", color: { argb: "FF999999" } } };
  }

  function rapikan(lembar: ExcelJS.Worksheet, lebar: number[], kolomAngka: number[]) {
    lebar.forEach((w, i) => {
      lembar.getColumn(i + 1).width = w;
    });
    for (const k of kolomAngka) {
      lembar.getColumn(k).numFmt = "#,##0";
      lembar.getColumn(k).alignment = { horizontal: "right" };
    }
  }

  /* ---------- Lembar 1: angka nyata ---------- */

  const l1 = siapkanLembar(
    "Nyata - Tagihan",
    "Laporan Margin · Nyata",
    "Uang yang sudah benar-benar ditagihkan, dikurangi biaya yang sudah dicatat.",
  );

  l1.getRow(5).values = ["Penjualan bersih", "Total biaya", "Margin", "Margin %"];
  l1.getRow(5).font = { bold: true };
  l1.getRow(6).values = [
    Number(ringkasanNyata.penjualan.toFixed(2)),
    Number(ringkasanNyata.biaya.toFixed(2)),
    Number(ringkasanNyata.untung.toFixed(2)),
    Number(ringkasanNyata.marginPersen.toFixed(2)),
  ];
  for (let i = 1; i <= 4; i++) l1.getRow(6).getCell(i).numFmt = "#,##0.##";

  tulisKepala(l1, [
    "No. Invoice",
    "Tanggal",
    "Customer",
    "Jenis Acara",
    "Penjualan",
    "Biaya",
    "Margin",
    "Margin %",
    "Status",
  ]);

  for (const b of nyata) {
    l1.addRow([
      b.nomor,
      format(b.tanggal, "dd/MM/yyyy"),
      b.pelanggan,
      b.jenisAcara ?? "",
      Number(b.penjualan.toFixed(2)),
      // Dibedakan dengan jelas dari biaya nol: tagihan yang belum punya
      // catatan biaya terbaca untung 100%, dan itu bukan keuntungan nyata.
      b.adaBiaya ? Number(b.biaya.toFixed(2)) : "belum dicatat",
      Number(b.untung.toFixed(2)),
      Number(b.marginPersen.toFixed(2)),
      b.final ? "Final" : "Draft",
    ]);
  }

  const total1 = l1.addRow([
    "TOTAL",
    "",
    `${nyata.length} tagihan`,
    "",
    Number(ringkasanNyata.penjualan.toFixed(2)),
    Number(ringkasanNyata.biaya.toFixed(2)),
    Number(ringkasanNyata.untung.toFixed(2)),
    Number(ringkasanNyata.marginPersen.toFixed(2)),
    ringkasanNyata.belumDicatat > 0
      ? `${ringkasanNyata.belumDicatat} tagihan tanpa catatan biaya`
      : "",
  ]);
  total1.font = { bold: true };
  total1.border = { top: { style: "thin", color: { argb: "FF999999" } } };

  rapikan(l1, [16, 12, 30, 20, 16, 16, 16, 10, 28], [5, 6, 7, 8]);

  /* ---------- Lembar 2: angka perkiraan ---------- */

  const l2 = siapkanLembar(
    "Perkiraan - Quotation",
    "Laporan Margin · Perkiraan",
    "Quotation yang BELUM jadi tagihan. Angka di sini perkiraan — jangan dijumlahkan dengan lembar Nyata.",
  );

  l2.getRow(5).values = [
    "Penjualan bersih",
    "Perkiraan biaya",
    "Perkiraan margin",
    "Margin %",
  ];
  l2.getRow(5).font = { bold: true };
  l2.getRow(6).values = [
    Number(ringkasanPerkiraan.penjualan.toFixed(2)),
    Number(ringkasanPerkiraan.biaya.toFixed(2)),
    Number(ringkasanPerkiraan.untung.toFixed(2)),
    Number(ringkasanPerkiraan.marginPersen.toFixed(2)),
  ];
  for (let i = 1; i <= 4; i++) l2.getRow(6).getCell(i).numFmt = "#,##0.##";

  tulisKepala(l2, [
    "No. Quotation",
    "Tanggal",
    "Customer",
    "Jenis Acara",
    "Penjualan",
    "Perkiraan Biaya",
    "Perkiraan Margin",
    "Margin %",
  ]);

  for (const b of perkiraan) {
    l2.addRow([
      b.nomor,
      format(b.tanggal, "dd/MM/yyyy"),
      b.pelanggan,
      b.jenisAcara ?? "",
      Number(b.hasil.net_sales.toFixed(2)),
      b.adaBiaya ? Number(b.hasil.total_cost.toFixed(2)) : "belum dicatat",
      Number(b.hasil.profit.toFixed(2)),
      Number(b.hasil.margin_percent.toFixed(2)),
    ]);
  }

  const total2 = l2.addRow([
    "TOTAL",
    "",
    `${perkiraan.length} quotation`,
    "",
    Number(ringkasanPerkiraan.penjualan.toFixed(2)),
    Number(ringkasanPerkiraan.biaya.toFixed(2)),
    Number(ringkasanPerkiraan.untung.toFixed(2)),
    Number(ringkasanPerkiraan.marginPersen.toFixed(2)),
  ]);
  total2.font = { bold: true };
  total2.border = { top: { style: "thin", color: { argb: "FF999999" } } };

  rapikan(l2, [16, 12, 30, 20, 16, 18, 18, 10], [5, 6, 7, 8]);

  const isi = await buku.xlsx.writeBuffer();
  const namaBerkas = `laporan-margin-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;

  return new NextResponse(isi as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
