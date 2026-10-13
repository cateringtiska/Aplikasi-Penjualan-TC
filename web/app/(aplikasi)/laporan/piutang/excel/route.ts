import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { penggunaAktif } from "@/lib/auth";
import { hanyaMiliknya } from "@/lib/rbac";
import { ambilPiutang, type BarisPiutang, KELOMPOK } from "@/lib/laporan-piutang";
import { d } from "@/lib/uang";

export const dynamic = "force-dynamic";

/* ==========================================================================
   KARTU PIUTANG SEBAGAI BUKU BESAR BERJALAN

   Bentuknya mengikuti kartu piutang yang sudah dipakai pemiliknya: satu
   baris satu invoice, berurutan menurut NOMOR INVOICE — yaitu urutan
   terbitnya — dengan kolom SALDO yang menumpuk dari atas ke bawah.

   URUTANNYA SENGAJA BERBEDA DARI LAYAR. Layar mengurutkan per customer
   supaya bisa dipakai menagih dengan satu telepon; berkas ini mengurutkan
   menurut terbitnya supaya saldonya bisa ditelusuri baris demi baris,
   sebagaimana buku besar dibaca. Yang TIDAK boleh berbeda adalah isinya:
   invoice yang sama, dengan angka yang sama. Itu yang dijaga tes, dan ia
   membandingkan menurut NOMOR INVOICE — bukan menurut posisi barisnya.

   Nilai uang ditulis sebagai ANGKA, bukan teks, supaya bisa langsung
   dijumlah oleh siapa pun yang menerimanya. Formatnya yang membuatnya
   terbaca "Rp 4.677.250,00".
   ========================================================================== */

/** Format akuntansi: Rp menempel di kiri sel, angkanya rata kanan. */
const RUPIAH_2 = '_("Rp"* #,##0.00_);_("Rp"* \\(#,##0.00\\);_("Rp"* "-"??_);_(@_)';
const RUPIAH_0 = '_("Rp"* #,##0_);_("Rp"* \\(#,##0\\);_("Rp"* "-"??_);_(@_)';

const KRIM = "FFFBE9DC";
const BIRU_MUDA = "FFEAF1F8";
const MERAH_TUA = "FFA32020";

const GARIS: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF999999" } },
  left: { style: "thin", color: { argb: "FF999999" } },
  bottom: { style: "thin", color: { argb: "FF999999" } },
  right: { style: "thin", color: { argb: "FF999999" } },
};

const KEPALA = [
  "NO",
  "TANGGAL INVOICE",
  "NO INVOICE",
  "NAMA PELANGGAN",
  "PENJUALAN",
  "UANG MUKA/CICILAN",
  "SISA PELUNASAN",
  "SALDO",
];

/** Baris kepala tabelnya. Baris di atasnya dipakai judul dan ringkasan umur. */
const BARIS_KEPALA = 8;

/**
 * Nama pelanggan beserta siapa yang dihubungi.
 *
 * Kartu piutang ini dibaca orang yang menagih, dan yang ia cari adalah nama
 * orangnya — bukan nama badan usahanya. Keduanya digabung karena kolomnya
 * memang satu.
 */
export function namaPelangganKartu(baris: Pick<BarisPiutang, "nama" | "pic">): string {
  return baris.pic ? `${baris.pic} - ${baris.nama}` : baris.nama;
}

/**
 * Urutan buku besar: menurut nomor invoice, yaitu urutan terbitnya.
 *
 * Saldo berjalan hanya bisa ditelusuri kalau barisnya berurutan terbit.
 * Diurutkan menurut tanggal, invoice yang terbit belakangan untuk acara
 * yang lebih awal akan menyelip di tengah dan saldonya melompat-lompat.
 */
export function urutanBukuBesar(daftar: BarisPiutang[]): BarisPiutang[] {
  return [...daftar].sort((a, b) => a.nomor.localeCompare(b.nomor, "en"));
}

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
    views: [{ state: "frozen", ySplit: BARIS_KEPALA }],
  });

  const kolomTerakhir = String.fromCharCode(64 + KEPALA.length);

  lembar.mergeCells(`A1:${kolomTerakhir}1`);
  lembar.getCell("A1").value = "Kartu Piutang";
  lembar.getCell("A1").font = { bold: true, size: 14 };

  lembar.mergeCells(`A2:${kolomTerakhir}2`);
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

  const kolom = (judul: string) => {
    const i = KEPALA.indexOf(judul);
    if (i < 0) throw new Error(`Kolom "${judul}" tidak ada di kepala tabel.`);
    return i + 1;
  };

  const barisKepala = lembar.getRow(BARIS_KEPALA);
  barisKepala.values = KEPALA;
  barisKepala.font = { bold: true };
  barisKepala.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  barisKepala.height = 24;
  for (let i = 1; i <= KEPALA.length; i += 1) {
    barisKepala.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KRIM } };
    barisKepala.getCell(i).border = GARIS;
  }

  /* ---------- Isi, dengan saldo yang menumpuk ---------- */

  let saldo = d(0);

  urutanBukuBesar(daftar).forEach((p, i) => {
    saldo = saldo.plus(p.sisa);

    const baris = lembar.addRow([
      i + 1,
      // Ditulis panjang — "30 Juni 2026" — sebagaimana kartu piutang yang
      // sudah dipakai. Bentuk pendek mudah tertukar antara tanggal dan
      // bulan ketika berkasnya dibuka di tempat yang setelannya berbeda.
      format(p.tanggal, "d MMMM yyyy", { locale: localeId }),
      p.nomor,
      namaPelangganKartu(p),
      Number(p.penjualan.toFixed(2)),
      // Kosong, bukan nol: nol terbaca sebagai "sudah diperiksa, memang
      // tidak ada", sedangkan kosong terbaca sebagai "belum ada pembayaran".
      p.dibayar.gt(0) ? Number(p.dibayar.toFixed(2)) : null,
      Number(p.sisa.toFixed(2)),
      Number(saldo.toFixed(2)),
    ]);

    for (let k = 1; k <= KEPALA.length; k += 1) baris.getCell(k).border = GARIS;

    baris.getCell(kolom("NO")).alignment = { horizontal: "center" };
    baris.getCell(kolom("TANGGAL INVOICE")).alignment = { horizontal: "right" };

    // Sisa pelunasan ditebalkan dan dimerahkan: inilah satu-satunya angka
    // di baris ini yang menjadi dasar menagih.
    baris.getCell(kolom("SISA PELUNASAN")).font = { bold: true, color: { argb: MERAH_TUA } };

    baris.getCell(kolom("SALDO")).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BIRU_MUDA },
    };
  });

  const barisTotal = lembar.addRow([
    "TOTAL",
    `${jumlahPelanggan} customer`,
    `${daftar.length} invoice`,
    "",
    Number(daftar.reduce((j, p) => j.plus(p.penjualan), d(0)).toFixed(2)),
    Number(daftar.reduce((j, p) => j.plus(p.dibayar), d(0)).toFixed(2)),
    Number(totalSemua.toFixed(2)),
    Number(totalSemua.toFixed(2)),
  ]);
  barisTotal.font = { bold: true };
  for (let k = 1; k <= KEPALA.length; k += 1) {
    barisTotal.getCell(k).border = {
      ...GARIS,
      top: { style: "double", color: { argb: "FF666666" } },
    };
  }

  /* ---------- Lebar dan format ---------- */

  const lebar = [6, 20, 18, 46, 20, 22, 20, 20];
  lebar.forEach((w, i) => {
    lembar.getColumn(i + 1).width = w;
  });

  for (const judul of ["PENJUALAN", "UANG MUKA/CICILAN"]) {
    lembar.getColumn(kolom(judul)).numFmt = RUPIAH_2;
  }
  for (const judul of ["SISA PELUNASAN", "SALDO"]) {
    lembar.getColumn(kolom(judul)).numFmt = RUPIAH_0;
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
