import { format } from "date-fns";
import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { penggunaAktif } from "@/lib/auth";
import { hanyaMiliknya } from "@/lib/rbac";
import { ambilPiutang, KELOMPOK } from "@/lib/laporan-piutang";

export const dynamic = "force-dynamic";

/**
 * Mengunduh kartu piutang sebagai berkas Excel.
 *
 * Angkanya dihitung lewat ambilPiutang yang sama dengan yang dipakai layar,
 * jadi berkas unduhan tidak mungkin menyimpang dari yang barusan dilihat.
 *
 * Nilai uang ditulis sebagai ANGKA, bukan teks — supaya bisa langsung
 * dijumlah di Excel oleh siapa pun yang menerimanya.
 */
export async function GET(request: NextRequest) {
  // Dibaca ulang dari database, bukan dari cookie: pengguna yang sudah
  // dinonaktifkan tidak boleh masih bisa mengunduh daftar piutang.
  const sesi = await penggunaAktif();
  if (!sesi) {
    return NextResponse.json({ pesan: "Silakan masuk lebih dulu." }, { status: 401 });
  }
  if (!["admin", "sales", "finance"].includes(sesi.peran)) {
    return NextResponse.json({ pesan: "Anda tidak punya akses." }, { status: 403 });
  }

  const cari = request.nextUrl.searchParams.get("cari")?.trim() ?? "";
  const { daftar, jumlahPelanggan, umur, totalSemua } = await ambilPiutang(
    cari,
    hanyaMiliknya(sesi),
  );

  const buku = new ExcelJS.Workbook();
  buku.creator = "Penjualan TC";
  buku.created = new Date();

  const lembar = buku.addWorksheet("Kartu Piutang", {
    views: [{ state: "frozen", ySplit: 8 }],
  });

  lembar.mergeCells("A1:F1");
  lembar.getCell("A1").value = "Kartu Piutang";
  lembar.getCell("A1").font = { bold: true, size: 14 };

  lembar.mergeCells("A2:F2");
  lembar.getCell("A2").value = `Per ${format(new Date(), "dd/MM/yyyy HH:mm")}${
    cari ? ` · pencarian: "${cari}"` : ""
  }`;
  lembar.getCell("A2").font = { color: { argb: "FF666666" } };

  // Ringkasan umur piutang ditaruh di atas, sama seperti di layar — inilah
  // angka yang pertama dicari orang saat membuka laporan ini.
  const barisUmur = lembar.getRow(4);
  barisUmur.values = KELOMPOK.map((k) => k.label);
  barisUmur.font = { bold: true };

  const barisNilai = lembar.getRow(5);
  barisNilai.values = KELOMPOK.map((k) => Number(umur[k.kunci].toFixed(2)));

  const KEPALA = [
    "Kode Customer",
    "Customer",
    // Siapa yang ditelepon saat menagih. Berkas ini dibuka orang yang
    // menagih, di tempat lain, tanpa layar aplikasinya — tanpa nama ini ia
    // harus kembali membuka aplikasinya satu per satu.
    "PIC",
    // Satu baris satu invoice, sama dengan layarnya. Dirangkum per
    // customer, berkas ini tidak bisa dipakai menagih: yang ditagih adalah
    // lembar invoice, masing-masing dengan nomor dan jatuh temponya
    // sendiri.
    "No. Invoice",
    "Tanggal Invoice",
    "Jatuh Tempo",
    "Hari Terlambat",
    "Sisa Piutang",
  ];

  /**
   * Nomor kolom menurut judulnya.
   *
   * Nomornya pernah ditulis langsung, dan menyisipkan satu kolom menggeser
   * seluruh format angkanya tanpa galat apa pun: kolom teks mendapat format
   * rupiah, kolom uang kehilangan pemisah ribuannya, dan berkasnya tetap
   * terbuka seolah tidak terjadi apa-apa.
   */
  const kolom = (judul: string) => {
    const i = KEPALA.indexOf(judul);
    if (i < 0) throw new Error(`Kolom "${judul}" tidak ada di kepala tabel.`);
    return i + 1;
  };

  const barisKepala = lembar.getRow(8);
  barisKepala.values = KEPALA;
  barisKepala.font = { bold: true };
  barisKepala.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F0F0" },
  };
  barisKepala.border = { bottom: { style: "thin", color: { argb: "FF999999" } } };

  for (const p of daftar) {
    lembar.addRow([
      p.kode,
      p.nama,
      p.pic ?? "",
      p.nomor,
      format(p.tanggal, "dd/MM/yyyy"),
      format(p.tempo, "dd/MM/yyyy"),
      p.hariTerlambat,
      Number(p.sisa.toFixed(2)),
    ]);
  }

  const barisTotal = lembar.addRow([
    "TOTAL",
    `${jumlahPelanggan} customer`,
    "",
    `${daftar.length} invoice`,
    "",
    "",
    "",
    Number(totalSemua.toFixed(2)),
  ]);
  barisTotal.font = { bold: true };
  barisTotal.border = { top: { style: "thin", color: { argb: "FF999999" } } };

  const lebar = [16, 30, 22, 18, 16, 16, 15, 18];
  lebar.forEach((w, i) => {
    lembar.getColumn(i + 1).width = w;
  });

  for (const judul of ["Hari Terlambat", "Sisa Piutang"]) {
    lembar.getColumn(kolom(judul)).numFmt = "#,##0";
    lembar.getColumn(kolom(judul)).alignment = { horizontal: "right" };
  }
  for (let i = 1; i <= KELOMPOK.length; i++) {
    lembar.getRow(5).getCell(i).numFmt = "#,##0";
  }

  const isi = await buku.xlsx.writeBuffer();
  const namaBerkas = `kartu-piutang-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;

  return new NextResponse(isi as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
