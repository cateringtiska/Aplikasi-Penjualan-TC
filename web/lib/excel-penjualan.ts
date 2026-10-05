import "server-only";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import ExcelJS from "exceljs";

import { type KeadaanPengakuan, LABEL_PENGAKUAN } from "./pengakuan";
import { ringkasTanggalAcara } from "./tanggal";
import { d } from "./uang";

/* ==========================================================================
   LAPORAN PENJUALAN DALAM BENTUK EXCEL

   Berkas ini diserahkan ke orang yang MENJURNAL, bukan sekadar dibaca. Jadi
   tiap barisnya memecah nilainya menjadi pos-pos yang berbeda perlakuannya:

     penjualan        pendapatan jasa katering
     service charge   pendapatan jasa, pos tersendiri
     PB1              pajak daerah yang DIPUNGUT untuk disetorkan — utang,
                      bukan penghasilan
     delivery         pendapatan di luar dasar pungutan
     biaya tambahan   pendapatan di luar dasar pungutan

   KELIMANYA BERJUMLAH TEPAT TOTAL INVOICE. Itu bukan kebetulan melainkan
   rumusnya sendiri, dan itu yang membuat tiap baris bisa diperiksa sendiri
   tanpa menebak sisanya. Satu kolom pemeriksa ikut dicetak: kalau pernah ada
   selisih, ia terbaca di situ, bukan ditemukan berbulan-bulan kemudian.

   DIPISAH PER KEADAAN PENGAKUAN, satu lembar masing-masing. Penjualan yang
   sudah diakui dan yang masih proyeksi dijurnal berbeda; menaruhnya dalam
   satu daftar panjang menyerahkan pemilahan itu kepada orang yang membacanya.
   ========================================================================== */

/** Satu baris laporan, sebagaimana dikembalikan ambilLaporan(). */
export type BarisLaporan = {
  nomor: string;
  tanggal: Date;
  jatuhTempo: Date;
  tanggalAcara: Date[];
  tanggalBayar: Date | null;
  pelanggan: string;
  acara: string;
  penjualan: string;
  serviceCharge: string;
  pb1: string;
  delivery: string;
  biayaTambahan: string;
  pph23: string;
  total: string;
  dibayar: string;
  sisa: string;
  statusLabel: string;
  pengakuan: KeadaanPengakuan;
};

export type Perusahaan = {
  nama: string;
  logo: ArrayBuffer | null;
};

const ABU = "FF6B7280";
const KOP = "FF1F3A2E";
const KOP_TEKS = "FFFFFFFF";
const GARIS = "FFD4D4D4";

/** Rupiah utuh: "Rp 7.605.000". Nol ditulis kosong supaya mata tidak lelah. */
const FORMAT_UANG = '"Rp" #,##0;[Red]-"Rp" #,##0;""';
const FORMAT_TANGGAL = "dd/mm/yyyy";

const KOLOM: { judul: string; lebar: number; jenis: "teks" | "uang" | "tanggal" }[] = [
  { judul: "No. Invoice", lebar: 17, jenis: "teks" },
  { judul: "Tanggal", lebar: 11, jenis: "tanggal" },
  { judul: "Customer", lebar: 32, jenis: "teks" },
  { judul: "Acara", lebar: 20, jenis: "teks" },
  { judul: "Tanggal acara", lebar: 20, jenis: "teks" },
  { judul: "Jatuh tempo", lebar: 11, jenis: "tanggal" },
  { judul: "Tanggal bayar", lebar: 11, jenis: "tanggal" },
  { judul: "Penjualan", lebar: 15, jenis: "uang" },
  { judul: "Service charge", lebar: 15, jenis: "uang" },
  { judul: "PB1", lebar: 14, jenis: "uang" },
  { judul: "Delivery", lebar: 13, jenis: "uang" },
  { judul: "Biaya tambahan", lebar: 15, jenis: "uang" },
  { judul: "Total invoice", lebar: 16, jenis: "uang" },
  { judul: "Selisih", lebar: 10, jenis: "uang" },
  { judul: "Terbayar", lebar: 15, jenis: "uang" },
  { judul: "PPh 23", lebar: 13, jenis: "uang" },
  { judul: "Sisa", lebar: 15, jenis: "uang" },
  { judul: "Status", lebar: 22, jenis: "teks" },
];

const KOLOM_TERAKHIR = String.fromCharCode(64 + KOLOM.length);

function isiBaris(b: BarisLaporan) {
  const pecahan = d(b.penjualan)
    .plus(d(b.serviceCharge))
    .plus(d(b.pb1))
    .plus(d(b.delivery))
    .plus(d(b.biayaTambahan));

  return [
    b.nomor,
    b.tanggal,
    b.pelanggan,
    b.acara,
    ringkasTanggalAcara(b.tanggalAcara) ?? "",
    b.jatuhTempo,
    b.tanggalBayar,
    Number(b.penjualan),
    Number(b.serviceCharge),
    Number(b.pb1),
    Number(b.delivery),
    Number(b.biayaTambahan),
    Number(b.total),
    // Harus NOL pada setiap baris. Dicetak, bukan disembunyikan: pemeriksaan
    // yang hanya dijalankan di dalam kode tidak bisa dilihat oleh orang yang
    // menerima berkasnya.
    Number(pecahan.minus(d(b.total))),
    Number(b.dibayar),
    Number(b.pph23),
    Number(b.sisa),
    b.statusLabel,
  ];
}

function gambarKop(
  lembar: ExcelJS.Worksheet,
  buku: ExcelJS.Workbook,
  perusahaan: Perusahaan,
  judul: string,
  periode: string,
  dicetakOleh: string,
): number {
  if (perusahaan.logo) {
    const gambar = buku.addImage({ buffer: perusahaan.logo as never, extension: "png" });
    lembar.addImage(gambar, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 44 } });
    lembar.getRow(1).height = 36;
  }

  lembar.mergeCells(`C1:${KOLOM_TERAKHIR}1`);
  lembar.getCell("C1").value = perusahaan.nama;
  lembar.getCell("C1").font = { bold: true, size: 13 };

  lembar.mergeCells(`C2:${KOLOM_TERAKHIR}2`);
  lembar.getCell("C2").value = judul;
  lembar.getCell("C2").font = { bold: true, size: 11 };

  lembar.mergeCells(`C3:${KOLOM_TERAKHIR}3`);
  lembar.getCell("C3").value = `Periode ${periode} · dicetak ${format(new Date(), "d MMMM yyyy HH:mm", { locale: localeId })} oleh ${dicetakOleh}`;
  lembar.getCell("C3").font = { size: 9, color: { argb: ABU } };

  return 5; // Baris kepala tabel.
}

function gambarTabel(lembar: ExcelJS.Worksheet, barisKepala: number, isi: BarisLaporan[]) {
  const kepala = lembar.getRow(barisKepala);
  kepala.values = KOLOM.map((k) => k.judul);
  kepala.font = { bold: true, color: { argb: KOP_TEKS } };
  kepala.height = 20;
  kepala.alignment = { vertical: "middle", wrapText: true };

  for (let i = 1; i <= KOLOM.length; i++) {
    kepala.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KOP } };
  }

  for (const b of isi) {
    const baris = lembar.addRow(isiBaris(b));

    for (let i = 1; i <= KOLOM.length; i++) {
      const sel = baris.getCell(i);
      sel.border = {
        top: { style: "hair", color: { argb: GARIS } },
        bottom: { style: "hair", color: { argb: GARIS } },
        left: { style: "hair", color: { argb: GARIS } },
        right: { style: "hair", color: { argb: GARIS } },
      };
    }

    // Selisih yang bukan nol diberi warna. Kalau suatu saat muncul, ia harus
    // menarik perhatian tanpa perlu dicari.
    const selisih = baris.getCell(14);
    if (Number(selisih.value) !== 0) {
      selisih.font = { bold: true, color: { argb: "FFB91C1C" } };
    }
  }

  const total = (kunci: keyof BarisLaporan) =>
    Number(isi.reduce((j, b) => j.plus(d(b[kunci] as string)), d(0)));

  const barisTotal = lembar.addRow([
    "TOTAL",
    null,
    `${isi.length} invoice`,
    null,
    null,
    null,
    null,
    total("penjualan"),
    total("serviceCharge"),
    total("pb1"),
    total("delivery"),
    total("biayaTambahan"),
    total("total"),
    null,
    total("dibayar"),
    total("pph23"),
    total("sisa"),
    null,
  ]);
  barisTotal.font = { bold: true };
  for (let i = 1; i <= KOLOM.length; i++) {
    barisTotal.getCell(i).border = { top: { style: "thin", color: { argb: KOP } } };
  }

  KOLOM.forEach((k, i) => {
    const kolom = lembar.getColumn(i + 1);
    kolom.width = k.lebar;
    if (k.jenis === "uang") {
      kolom.numFmt = FORMAT_UANG;
      kolom.alignment = { horizontal: "right" };
    }
    if (k.jenis === "tanggal") {
      kolom.numFmt = FORMAT_TANGGAL;
      kolom.alignment = { horizontal: "center" };
    }
  });

  // Kepala tabel dibekukan dan diberi saringan, supaya berkas ratusan baris
  // tetap bisa dibaca tanpa kehilangan nama kolomnya.
  lembar.views = [{ state: "frozen", ySplit: barisKepala }];
  lembar.autoFilter = {
    from: { row: barisKepala, column: 1 },
    to: { row: barisKepala + isi.length, column: KOLOM.length },
  };
}

const URUTAN: KeadaanPengakuan[] = ["diakui", "uang_muka", "diterima_di_muka", "proyeksi"];

/** Satu kalimat yang menjelaskan cara menjurnal keadaan itu. */
const PENJELASAN: Record<KeadaanPengakuan, string> = {
  diakui: "Acaranya sudah terjadi. Penjualan diakui; sisanya piutang.",
  uang_muka:
    "Acaranya belum terjadi dan belum lunas. Uang yang masuk adalah uang muka — utang, bukan penghasilan.",
  diterima_di_muka:
    "Acaranya belum terjadi dan sudah lunas. Seluruhnya pendapatan diterima di muka — utang sampai acaranya berjalan.",
  proyeksi: "Acaranya belum terjadi dan belum ada uang masuk. Belum dijurnal sebagai apa pun.",
};

export async function buatBukuPenjualan(argumen: {
  baris: BarisLaporan[];
  periode: string;
  perusahaan: Perusahaan;
  dicetakOleh: string;
}): Promise<ExcelJS.Workbook> {
  const buku = new ExcelJS.Workbook();
  buku.creator = argumen.perusahaan.nama;
  buku.created = new Date();

  for (const keadaan of URUTAN) {
    const isi = argumen.baris.filter((b) => b.pengakuan === keadaan);

    // Lembar kosong TETAP DIBUAT. Lembar yang hilang terbaca sebagai
    // "laporannya tidak lengkap"; lembar kosong yang menyebutkan sendiri
    // bahwa memang tidak ada isinya tidak menimbulkan pertanyaan.
    const lembar = buku.addWorksheet(LABEL_PENGAKUAN[keadaan], {
      properties: { defaultRowHeight: 16 },
    });

    const barisKepala = gambarKop(
      lembar,
      buku,
      argumen.perusahaan,
      `Laporan Penjualan — ${LABEL_PENGAKUAN[keadaan]}`,
      argumen.periode,
      argumen.dicetakOleh,
    );

    lembar.mergeCells(`A${barisKepala - 1}:${KOLOM_TERAKHIR}${barisKepala - 1}`);
    lembar.getCell(`A${barisKepala - 1}`).value = PENJELASAN[keadaan];
    lembar.getCell(`A${barisKepala - 1}`).font = { italic: true, size: 9, color: { argb: ABU } };

    gambarTabel(lembar, barisKepala, isi);
  }

  return buku;
}
