import "server-only";

import ExcelJS from "exceljs";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { barisTabelDokumen, barisTotalDokumen, type ItemCetak } from "./baris-cetak";
import { jumlahHariAcara, ringkasTanggalAcara } from "./tanggal";

/* ==========================================================================
   DOKUMEN CETAK SEBAGAI BERKAS EXCEL

   Quotation dan invoice yang sama, dalam bentuk yang bisa dibuka dan
   dihitung ulang penerimanya. Beberapa customer meminta rinciannya dalam
   Excel untuk dicocokkan dengan anggarannya sendiri.

   SUSUNAN BARISNYA TIDAK DIHITUNG DI SINI. Ia diambil dari lib/baris-cetak.ts,
   modul yang sama yang dipakai halaman cetaknya. Kalau keduanya menghitung
   sendiri-sendiri, cepat atau lambat kertas dan berkasnya akan menyebut
   angka berbeda untuk satu pesanan — dan tidak ada yang akan menyadarinya
   sampai salah satunya dipakai menagih.

   SATU HAL YANG MEMANG BERBEDA, dan disengaja: uang ditulis sebagai ANGKA,
   bukan sebagai teks "Rp 1.520.000". Berkas yang angkanya berupa teks tidak
   bisa dijumlah sama sekali, dan yang membukanya akan mengetik ulang seluruh
   kolomnya. Formatnya yang membuatnya terbaca "Rp 1.520.000" di layar.
   ========================================================================== */

const FORMAT_RUPIAH = '"Rp" #,##0';

const ABU = "FFF0F0F0";
const ABU_TUA = "FFD9D9D9";
const BIRU = "FF1F4E79";
const LATAR_JUDUL = "FFDCE6F1";
const LATAR_TOTAL = "FFEAF1DD";
const LATAR_TOTAL_AKHIR = "FFD8E4BC";
const MERAH = "FFE00000";

const GARIS: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF999999" } },
  left: { style: "thin", color: { argb: "FF999999" } },
  bottom: { style: "thin", color: { argb: "FF999999" } },
  right: { style: "thin", color: { argb: "FF999999" } },
};

/** Lebar kolom mengikuti lebar kolom dokumen cetaknya. */
const LEBAR = [6, 42, 7, 7, 8, 10, 16, 18];

/** Banyaknya kolom tabel rincian: No, Deskripsi, Day, Qty, Pax, Vol., Harga, Total. */
const KOLOM = LEBAR.length;

export type IsiExcelDokumen = {
  judul: string;
  labelNomor: string;
  nomor: string;
  revisi?: number;
  tanggalRevisi?: Date | null;
  referensiPo?: string | null;
  tanggal: Date;
  labelTanggalKedua: string;
  tanggalKedua: Date;

  pelanggan: { nama: string; alamat: string | null };
  kontak: { nama: string | null; telepon: string | null };

  acara: {
    tanggal: Date[];
    tamu: number | null;
    planner: string | null;
    jam: string | null;
    venue: string | null;
    jenis: string | null;
  };

  baris: ItemCetak[];

  subtotal: string;
  service_charge_percent: string | null;
  service_charge_amount: string;
  pb1_enabled: boolean;
  pb1_percent: string | null;
  pb1_amount: string;
  delivery_amount: string;
  biaya_tambahan: { id: string; label: string; amount: string }[];
  grand_total: string;

  catatan: string | null;
  syarat: string | null;

  perusahaan: {
    company_name: string;
    signature_name: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_holder: string | null;
    bank_code: string | null;
    swift_code: string | null;
  };
};

export async function buatExcelDokumen(isi: IsiExcelDokumen): Promise<ArrayBuffer> {
  const buku = new ExcelJS.Workbook();
  buku.creator = isi.perusahaan.company_name;
  buku.created = new Date();

  const lembar = buku.addWorksheet(isi.judul, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });

  LEBAR.forEach((w, i) => {
    lembar.getColumn(i + 1).width = w;
  });

  /** Satu baris kepala tiga kolom: A–C, D–E, F–G. */
  const barisTiga = (kiri: [string, string], tengah: [string, string], kanan: [string, string]) => {
    const b = lembar.addRow([]);
    const n = b.number;

    lembar.mergeCells(n, 1, n, 3);
    lembar.mergeCells(n, 4, n, 6);
    lembar.mergeCells(n, 7, n, KOLOM);

    for (const [kolom, [label, nilai]] of [
      [1, kiri],
      [4, tengah],
      [7, kanan],
    ] as const) {
      const sel = b.getCell(kolom);
      // Labelnya tebal, isinya tidak — seperti di kertasnya.
      sel.value =
        label === ""
          ? nilai
          : { richText: [{ font: { bold: true }, text: `${label} ` }, { text: nilai }] };
      sel.alignment = { vertical: "top", wrapText: true };
      sel.border = GARIS;
    }

    for (const kolom of [2, 3, 5, 6, 8]) b.getCell(kolom).border = GARIS;
    return b;
  };

  /** Satu baris melebar penuh A–G. */
  const barisPenuh = (nilai: ExcelJS.CellValue, gaya?: Partial<ExcelJS.Style>) => {
    const b = lembar.addRow([]);
    const n = b.number;
    lembar.mergeCells(n, 1, n, KOLOM);

    const sel = b.getCell(1);
    sel.value = nilai;
    if (gaya?.font) sel.font = gaya.font;
    if (gaya?.alignment) sel.alignment = gaya.alignment;
    if (gaya?.fill) sel.fill = gaya.fill;
    if (gaya?.border) for (let i = 1; i <= KOLOM; i += 1) b.getCell(i).border = gaya.border;

    return b;
  };

  const kosong = () => lembar.addRow([]);

  /* ---------- Kepala ---------- */

  const namaPerusahaan = barisPenuh(isi.perusahaan.company_name, {
    font: { bold: true, size: 14, color: { argb: BIRU } },
    alignment: { horizontal: "center" },
  });
  namaPerusahaan.height = 22;
  kosong();

  const nomorLengkap =
    isi.revisi && isi.revisi > 0
      ? `${isi.nomor} (Revisi ${isi.revisi}${
          isi.tanggalRevisi ? ` · ${format(isi.tanggalRevisi, "dd/MM/yyyy")}` : ""
        })`
      : isi.nomor;

  barisTiga(
    ["Account Name:", isi.pelanggan.nama],
    ["UP - Kepada:", isi.kontak.nama || "-"],
    [`${isi.labelNomor}:`, nomorLengkap],
  );
  barisTiga(
    ["Alamat:", isi.pelanggan.alamat || "-"],
    ["Phone:", isi.kontak.telepon || "-"],
    ["Tanggal:", format(isi.tanggal, "dd/MM/yyyy")],
  );
  barisTiga(
    ["", ""],
    ["", ""],
    [`${isi.labelTanggalKedua}:`, format(isi.tanggalKedua, "dd/MM/yyyy")],
  );

  // Barisnya hanya ada kalau nomornya ada: "Referensi PO: -" pada dokumen
  // yang memang tidak punya hanya mengundang pertanyaan.
  if (isi.referensiPo) {
    barisTiga(["", ""], ["", ""], ["Referensi PO:", isi.referensiPo]);
  }

  kosong();

  const judul = barisPenuh(
    isi.judul.toUpperCase() + (isi.acara.jenis ? ` - ${isi.acara.jenis.toUpperCase()}` : ""),
    {
      font: { bold: true, size: 13 },
      alignment: { horizontal: "center", vertical: "middle" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ABU } },
      border: GARIS,
    },
  );
  judul.height = 26;

  /* ---------- Acara ---------- */

  const tanggalAcara = ringkasTanggalAcara(isi.acara.tanggal);
  const hariAcara = jumlahHariAcara(isi.acara.tanggal);
  const adaAcara = Boolean(tanggalAcara || isi.acara.venue || isi.acara.tamu);

  if (adaAcara) {
    kosong();
    barisTiga(
      ["Tanggal Acara:", tanggalAcara ?? "-"],
      ["Jumlah Hari:", hariAcara > 0 ? String(hariAcara) : "-"],
      ["Jumlah Tamu:", isi.acara.tamu ? String(isi.acara.tamu) : "-"],
    );
    barisTiga(
      ["F&B Planner:", isi.acara.planner || "-"],
      ["Jam:", isi.acara.jam || "-"],
      ["Lokasi:", isi.acara.venue || "-"],
    );
  }

  kosong();

  if (tanggalAcara) {
    barisPenuh(tanggalAcara + (hariAcara > 1 ? ` · ${hariAcara} hari` : ""), {
      font: { bold: true, color: { argb: BIRU } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: LATAR_JUDUL } },
      border: GARIS,
    });
  }

  /* ---------- Rincian ---------- */

  const kepala = lembar.addRow([
    "No",
    "Deskripsi",
    "Day",
    "Qty",
    "Pax",
    "Vol.",
    "Harga Satuan",
    "Total",
  ]);
  kepala.eachCell((sel) => {
    sel.font = { bold: true };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
    sel.border = GARIS;
    sel.alignment = { horizontal: "center", vertical: "middle" };
  });
  kepala.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
  kepala.getCell(8).alignment = { horizontal: "right", vertical: "middle" };

  for (const b of barisTabelDokumen(isi.baris)) {
    if (b.jenis === "totalKelompok") {
      const baris = lembar.addRow([b.label, "", "", "", "", "", "", b.nilaiAngka]);
      const n = baris.number;
      lembar.mergeCells(n, 1, n, KOLOM - 1);

      baris.eachCell({ includeEmpty: true }, (sel) => {
        sel.font = { bold: true };
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LATAR_JUDUL } };
        sel.border = GARIS;
      });
      baris.getCell(KOLOM).numFmt = FORMAT_RUPIAH;
      continue;
    }

    // Isi paket yang tidak berharga menumpang di kolom deskripsi, persis
    // seperti di kertasnya.
    const deskripsi =
      b.rincian.length > 0
        ? `${b.nama}\n${b.rincian
            .map((r) => `   - ${r.nama}${r.keterangan ? ` (${r.keterangan})` : ""}`)
            .join("\n")}`
        : b.menjorok
          ? `   ${b.nama}`
          : b.nama;

    const baris = lembar.addRow([
      b.nomor,
      deskripsi,
      b.hariAngka,
      b.qtyAngka,
      b.paxAngka,
      b.satuan,
      // "Compliment" memang teks, dan itu yang tercetak di kertasnya.
      b.hargaAngka ?? (b.harga || null),
      b.nilaiAngka ?? (b.nilai || null),
    ]);

    baris.eachCell({ includeEmpty: true }, (sel) => {
      sel.border = GARIS;
      sel.alignment = { vertical: "top" };
    });

    baris.getCell(1).alignment = { horizontal: "center", vertical: "top" };
    baris.getCell(2).alignment = { vertical: "top", wrapText: true };
    for (const kolom of [3, 4, 5, 6]) {
      baris.getCell(kolom).alignment = { horizontal: "center", vertical: "top" };
    }
    for (const kolom of [7, 8]) {
      baris.getCell(kolom).alignment = { horizontal: "right", vertical: "top" };
      if (typeof baris.getCell(kolom).value === "number") {
        baris.getCell(kolom).numFmt = FORMAT_RUPIAH;
      }
    }

    if (b.judul) {
      baris.eachCell({ includeEmpty: true }, (sel) => {
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LATAR_JUDUL } };
      });
      baris.getCell(2).font = { bold: true, color: { argb: BIRU } };
    } else if (!b.menjorok) {
      baris.getCell(2).font = { bold: true, color: { argb: BIRU } };
    }
  }

  for (const b of barisTotalDokumen(isi)) {
    const baris = lembar.addRow([b.label, "", "", "", "", "", "", b.nilaiAngka]);
    const n = baris.number;
    lembar.mergeCells(n, 1, n, KOLOM - 1);

    baris.eachCell({ includeEmpty: true }, (sel) => {
      sel.font = { bold: true };
      sel.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: b.akhir ? LATAR_TOTAL_AKHIR : LATAR_TOTAL },
      };
      sel.border = GARIS;
    });
    baris.getCell(KOLOM).numFmt = FORMAT_RUPIAH;
    baris.getCell(KOLOM).alignment = { horizontal: "right" };
  }

  /* ---------- Catatan, syarat, pembayaran ---------- */

  if (isi.catatan) {
    kosong();
    barisPenuh(
      { richText: [{ font: { bold: true }, text: "Catatan: " }, { text: isi.catatan }] },
      { alignment: { wrapText: true, vertical: "top" } },
    );
  }

  if (isi.syarat) {
    kosong();
    barisPenuh("Syarat & Ketentuan / Termin Pembayaran:", {
      font: { bold: true },
      border: GARIS,
    });
    /* --------------------------------------------------------------------
       SATU KLAUSA, SATU BARIS

       Seluruh syaratnya dulu ditumpuk ke dalam SATU sel yang digabung A–G.
       Di kertas itu terlihat benar, tetapi di Excel satu sel berisi delapan
       klausa tidak bisa dibaca sebagian, tidak bisa disunting salah satunya,
       dan tidak bisa disalin per butir — yang membukanya harus menyeret satu
       blok raksasa atau mengetik ulang seluruhnya.

       Tiap klausa karena itu mendapat barisnya sendiri, dan selnya TIDAK
       digabung: teksnya meluber ke kolom kosong di kanannya persis seperti
       sel biasa, sementara tiap barisnya tetap bisa disunting sendiri.
       -------------------------------------------------------------------- */
    for (const klausa of isi.syarat.split(/\r?\n/)) {
      const baris = lembar.addRow([klausa.trim()]);
      baris.getCell(1).alignment = { vertical: "top" };
      for (let i = 1; i <= KOLOM; i += 1) baris.getCell(i).border = GARIS;
    }
  }

  if (isi.perusahaan.bank_name) {
    kosong();

    const garisBank: ExcelJS.CellValue = {
      richText: [
        { text: "Pembayaran via transfer ke Rekening BARU: " },
        { font: { bold: true, color: { argb: MERAH } }, text: isi.perusahaan.bank_name },
      ],
    };
    barisPenuh(garisBank, {
      font: { bold: true },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ABU_TUA } },
      border: GARIS,
    });

    if (isi.perusahaan.bank_account_number) {
      barisPenuh(
        {
          richText: [
            { text: "Account number: " },
            {
              font: { bold: true, color: { argb: MERAH } },
              text: isi.perusahaan.bank_account_number,
            },
            ...(isi.perusahaan.bank_account_holder
              ? [
                  { text: " atas nama pemilik rekening: " },
                  {
                    font: { bold: true, color: { argb: MERAH } },
                    text: isi.perusahaan.bank_account_holder,
                  },
                ]
              : []),
          ],
        },
        {
          alignment: { horizontal: "center" },
          fill: { type: "pattern", pattern: "solid", fgColor: { argb: ABU_TUA } },
          border: GARIS,
        },
      );
    }

    if (isi.perusahaan.bank_code || isi.perusahaan.swift_code) {
      const bagian = [
        isi.perusahaan.bank_code ? `Bank Code: ${isi.perusahaan.bank_code}` : null,
        isi.perusahaan.swift_code ? `Swift Code: ${isi.perusahaan.swift_code}` : null,
      ].filter(Boolean);

      barisPenuh(bagian.join("; "), {
        alignment: { horizontal: "center" },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: ABU_TUA } },
        border: GARIS,
      });
    }
  }

  /* ---------- Tanda tangan ---------- */

  kosong();
  kosong();

  const ttd = lembar.addRow(["Hormat Kami,", "", "", "", "Persetujuan Klien,"]);
  ttd.getCell(1).font = { bold: true };
  ttd.getCell(5).font = { bold: true };

  // Ruang kosong untuk tanda tangan basah. Gambarnya tidak disertakan:
  // berkas Excel memang untuk dicocokkan angkanya, dan tanda tangan yang
  // ikut tersalin ke berkas yang bisa diedit siapa saja bukan hal yang
  // pantas dikirimkan.
  kosong();
  kosong();
  kosong();

  const namaTtd = lembar.addRow([
    isi.perusahaan.signature_name || isi.perusahaan.company_name,
    "",
    "",
    "",
    "(.............................)",
  ]);
  namaTtd.getCell(1).font = { bold: true };

  lembar.addRow([isi.perusahaan.company_name]);

  const isiBerkas = await buku.xlsx.writeBuffer();
  return isiBerkas as ArrayBuffer;
}

/** Nama berkas unduhan, dari nomor dokumennya. */
export function namaBerkasDokumen(nomor: string, tanggal: Date): string {
  const bersih = nomor.replace(/[^A-Za-z0-9-]+/g, "-");
  return `${bersih}-${format(tanggal, "yyyyMMdd", { locale: localeId })}.xlsx`;
}
