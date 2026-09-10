import { Decimal } from "decimal.js";

/* ==========================================================================
   PERHITUNGAN UANG

   Berkas ini adalah terjemahan langsung dari rumus di aplikasi Laravel:
     app/Livewire/FormInvoice.php   baris 171-200
     app/Livewire/FormQuotation.php baris 133-162
     app/Models/Invoice.php         baris 79-117
     app/Livewire/InvoiceMargin.php baris 165-183
     app/Models/InvoiceCost.php     baris 21-30

   Dua aturan yang dipegang di seluruh berkas ini:

   1. TIDAK ADA number JavaScript untuk uang. Semua lewat Decimal.
      Angka pecahan JavaScript tidak bisa menyimpan 0,1 dengan tepat; pada
      penjumlahan ratusan baris invoice, selisihnya muncul sebagai rupiah
      yang hilang atau bertambah sendiri.

   2. Pembulatan meniru fungsi round() milik PHP, yaitu membulatkan ke
      tetangga terdekat dan bila tepat di tengah membulat MENJAUHI nol.
      Itu ROUND_HALF_UP di decimal.js. Kalau ini keliru, selisihnya satu
      rupiah per dokumen — cukup untuk membuat laporan tidak pernah cocok.
   ========================================================================== */

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type NilaiUang = Decimal | number | string | null | undefined;

/** Mengubah apa pun menjadi Decimal; nilai kosong menjadi nol. */
export function d(nilai: NilaiUang): Decimal {
  if (nilai === null || nilai === undefined || nilai === "") return new Decimal(0);
  return new Decimal(nilai.toString());
}

/** Membulatkan ke rupiah utuh, meniru round() PHP. */
export function bulatkanRupiah(nilai: NilaiUang): Decimal {
  return d(nilai).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/* -------------------------------------------------------------------------
   BARIS ITEM
   ------------------------------------------------------------------------- */

export type BarisItem = {
  qty: NilaiUang;
  price: NilaiUang;
  /** Item compliment tetap tercetak di dokumen, tetapi dihitung nol. */
  is_compliment?: boolean;
  /** Hanya baris bertanda ini yang masuk dasar perhitungan service charge. */
  charge_service?: boolean;
};

/** Nilai satu baris. Compliment selalu nol. */
export function subtotalBaris(item: BarisItem): Decimal {
  if (item.is_compliment) return new Decimal(0);
  return d(item.qty).times(d(item.price));
}

/** Jumlah seluruh baris — inilah "subtotal" dokumen. */
export function hitungSubtotal(items: BarisItem[]): Decimal {
  return items.reduce((jumlah, item) => jumlah.plus(subtotalBaris(item)), new Decimal(0));
}

/**
 * Dasar perhitungan service charge.
 *
 * PENTING: ini BUKAN subtotal. Hanya baris yang ditandai kena service charge
 * DAN bukan compliment yang ikut. Sebuah dokumen bisa punya subtotal 10 juta
 * tetapi dasar service charge hanya 6 juta.
 *
 * Catatan: charge_service dianggap true bila tidak diisi — sama seperti
 * perilaku `$item['charge_service'] ?? true` di Laravel.
 */
export function dasarServiceCharge(items: BarisItem[]): Decimal {
  return items
    .filter((item) => (item.charge_service ?? true) && !item.is_compliment)
    .reduce((jumlah, item) => jumlah.plus(d(item.qty).times(d(item.price))), new Decimal(0));
}

/* -------------------------------------------------------------------------
   TOTAL DOKUMEN (quotation & invoice memakai rumus yang sama persis)
   ------------------------------------------------------------------------- */

export type MasukanTotal = {
  items: BarisItem[];
  /** Persen service charge. Kosong atau nol berarti tidak dikenakan. */
  service_charge_percent?: NilaiUang;
  /** PB1 hanya dihitung bila dinyalakan pada dokumen ini. */
  pb1_enabled?: boolean;
  pb1_percent?: NilaiUang;
};

export type HasilTotal = {
  subtotal: Decimal;
  dasar_service_charge: Decimal;
  service_charge_amount: Decimal;
  pb1_amount: Decimal;
  grand_total: Decimal;
};

export function hitungTotalDokumen(masukan: MasukanTotal): HasilTotal {
  const subtotal = hitungSubtotal(masukan.items);
  const dasar = dasarServiceCharge(masukan.items);

  // Laravel: $this->service_charge_percent ? round(...) : 0
  // Di PHP, "0" dan "" sama-sama falsy, jadi persen nol berarti tidak dikenakan.
  const persenSc = d(masukan.service_charge_percent);
  const service_charge_amount = persenSc.isZero()
    ? new Decimal(0)
    : bulatkanRupiah(dasar.times(persenSc).dividedBy(100));

  // PB1 dihitung dari SUBTOTAL, bukan dari subtotal + service charge.
  const pb1_amount = masukan.pb1_enabled
    ? bulatkanRupiah(subtotal.times(d(masukan.pb1_percent)).dividedBy(100))
    : new Decimal(0);

  return {
    subtotal,
    dasar_service_charge: dasar,
    service_charge_amount,
    pb1_amount,
    grand_total: subtotal.plus(service_charge_amount).plus(pb1_amount),
  };
}

/* -------------------------------------------------------------------------
   STATUS PEMBAYARAN INVOICE
   ------------------------------------------------------------------------- */

export type StatusInvoice = "unpaid" | "partial" | "paid" | "overdue" | "cancelled";

export function sisaTagihan(grandTotal: NilaiUang, paidAmount: NilaiUang): Decimal {
  return d(grandTotal).minus(d(paidAmount));
}

/**
 * Menentukan ulang status invoice dari jumlah yang sudah dibayar.
 *
 * Urutan pemeriksaannya sengaja dipertahankan persis seperti Laravel:
 * JATUH TEMPO diperiksa SEBELUM dibayar-sebagian. Artinya invoice yang sudah
 * lewat tanggal jatuh tempo tetap berstatus "overdue" walaupun sudah dibayar
 * sebagian. Tampilannya dijelaskan lewat labelStatusInvoice() di bawah.
 */
export function hitungStatusInvoice(argumen: {
  statusSekarang: StatusInvoice | string;
  grandTotal: NilaiUang;
  totalDibayar: NilaiUang;
  dueDate: Date;
  sekarang?: Date;
}): StatusInvoice {
  if (argumen.statusSekarang === "cancelled") return "cancelled";

  const dibayar = d(argumen.totalDibayar);
  const total = d(argumen.grandTotal);
  const sekarang = argumen.sekarang ?? new Date();

  if (dibayar.gte(total) && total.gt(0)) return "paid";
  if (argumen.dueDate.getTime() < sekarang.getTime()) return "overdue";
  if (dibayar.gt(0)) return "partial";
  return "unpaid";
}

export function labelStatusInvoice(status: string, sudahDibayar: NilaiUang): string {
  if (status === "overdue" && d(sudahDibayar).gt(0)) {
    return "Jatuh Tempo — Sebagian Terbayar";
  }

  const label: Record<string, string> = {
    unpaid: "Belum Dibayar",
    partial: "Dibayar Sebagian",
    paid: "Lunas",
    overdue: "Jatuh Tempo",
    cancelled: "Dibatalkan",
  };

  return label[status] ?? status;
}

/* -------------------------------------------------------------------------
   BIAYA & MARGIN
   ------------------------------------------------------------------------- */

export type BarisBiaya = {
  estimated_amount?: NilaiUang;
  actual_amount?: NilaiUang;
};

/**
 * Nilai satu baris biaya.
 *
 * Aturannya: biaya aktual MENIMPA estimasi, tetapi hanya kalau aktualnya
 * lebih besar dari nol. Baris beraktual nol tetap memakai angka estimasi —
 * ini perilaku Laravel yang dipertahankan apa adanya.
 */
export function nilaiBiaya(biaya: BarisBiaya): Decimal {
  const aktual = d(biaya.actual_amount);
  if (aktual.gt(0)) return aktual;
  return d(biaya.estimated_amount);
}

export type HasilMargin = {
  net_sales: Decimal;
  total_cost: Decimal;
  profit: Decimal;
  margin_percent: Decimal;
  profit_status: "untung" | "rugi";
};

/**
 * Untung-rugi satu invoice.
 *
 * PENTING: penjualan bersih diambil dari SUBTOTAL invoice, bukan grand total.
 * Service charge dan PB1 sengaja tidak dihitung sebagai pendapatan — PB1
 * adalah pajak yang diteruskan ke pemerintah, bukan uang perusahaan.
 */
export function hitungMargin(argumen: {
  subtotalInvoice: NilaiUang;
  biaya: BarisBiaya[];
}): HasilMargin {
  const net_sales = d(argumen.subtotalInvoice);
  const total_cost = argumen.biaya.reduce(
    (jumlah, baris) => jumlah.plus(nilaiBiaya(baris)),
    new Decimal(0),
  );
  const profit = net_sales.minus(total_cost);

  const margin_percent = net_sales.gt(0)
    ? profit.dividedBy(net_sales).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(0);

  return {
    net_sales,
    total_cost,
    profit,
    margin_percent,
    profit_status: profit.gte(0) ? "untung" : "rugi",
  };
}

/* -------------------------------------------------------------------------
   TAMPILAN
   ------------------------------------------------------------------------- */

const formatRupiah = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 1250000 -> "1.250.000" */
export function angka(nilai: NilaiUang): string {
  return formatRupiah.format(d(nilai).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber());
}

/** 1250000 -> "Rp 1.250.000" */
export function rupiah(nilai: NilaiUang): string {
  return `Rp ${angka(nilai)}`;
}

/**
 * Membaca angka yang diketik orang Indonesia menjadi Decimal.
 *
 * Di Indonesia titik adalah pemisah ribuan dan koma adalah pemisah desimal —
 * kebalikan dari cara JavaScript membaca angka. Tanpa penerjemahan ini,
 * "85.000" akan terbaca sebagai delapan puluh lima koma nol, dan harga
 * delapan puluh lima ribu tersimpan menjadi delapan puluh lima rupiah.
 *
 * Mengembalikan null kalau isinya bukan angka, supaya pemanggil bisa
 * menampilkan pesan kesalahan alih-alih diam-diam menyimpan nol.
 */
export function uraikanRupiah(teks: unknown): Decimal | null {
  if (teks === null || teks === undefined) return null;

  const bersih = String(teks).trim().replace(/\s/g, "");
  if (bersih === "") return null;

  // Buang pemisah ribuan, lalu ubah koma desimal menjadi titik.
  const normal = bersih.replace(/\./g, "").replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;

  try {
    return new Decimal(normal);
  } catch {
    return null;
  }
}

/** Angka Romawi untuk penomoran grup item di PDF: I, II, III, IV... */
export function romawi(angka: number): string {
  if (angka <= 0) return String(angka);

  const peta: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];

  let sisa = angka;
  let hasil = "";
  for (const [nilai, simbol] of peta) {
    while (sisa >= nilai) {
      hasil += simbol;
      sisa -= nilai;
    }
  }
  return hasil;
}
