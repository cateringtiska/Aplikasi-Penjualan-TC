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
  charge_pb1?: boolean;
};

/**
 * Baris yang boleh punya sub-item berharga.
 *
 * Dua bentuk dipakai bersamaan di dokumen sungguhan:
 *
 *   PAKET BERHARGA   induknya punya qty dan harga; anaknya sekadar rincian
 *                    isi, tanpa harga sendiri.
 *   KEPALA KELOMPOK  induknya hanya judul ("ANEKA STALL") tanpa qty maupun
 *                    harga; anaknya yang membawa angkanya.
 *
 * Keduanya bekerja dengan satu aturan yang sama: SETIAP BARIS dihitung
 * sebesar qty kali harganya sendiri. Kepala kelompok bernilai nol karena
 * qty-nya nol, bukan karena diperlakukan khusus.
 */
export type BarisBerAnak = BarisItem & { children?: BarisItem[] };

/**
 * Induk dan anaknya menjadi satu daftar rata.
 *
 * Anak MEWARISI penanda induknya — compliment, service charge, PB1 — kecuali
 * ia menyebutkan sendiri. Satu kelompok stall dikenai pungutan sebagai satu
 * kesatuan; meminta tiga kotak centang di setiap sub-item hanya akan membuat
 * formulirnya menyiksa tanpa menambah ketelitian.
 */
export function ratakanBaris(items: BarisBerAnak[]): BarisItem[] {
  return items.flatMap((induk) => {
    const anak = (induk.children ?? []).map((a) => ({
      ...a,
      is_compliment: a.is_compliment ?? induk.is_compliment,
      charge_service: a.charge_service ?? induk.charge_service,
      charge_pb1: a.charge_pb1 ?? induk.charge_pb1,
    }));

    // Begitu ada sub-item berharga, induknya menjadi JUDUL KELOMPOK dan
    // angkanya sendiri diabaikan. Tanpa ini, baris induk yang qty-nya masih
    // 1 dari bawaan formulir ikut terhitung — dan kalau harganya juga
    // terisi, nilainya terhitung DUA KALI.
    return [punyaAnakBerharga(induk) ? { ...induk, qty: 0, price: 0 } : induk, ...anak];
  });
}

/**
 * Apakah baris ini judul kelompok?
 *
 * Ditentukan oleh anaknya, bukan oleh isian induknya. Meminta orang
 * mengosongkan qty dan harga induk secara manual berarti menuntut mereka
 * mengingat aturan yang bisa disimpulkan sendiri oleh aplikasinya.
 */
export function punyaAnakBerharga(induk: BarisBerAnak): boolean {
  return (induk.children ?? []).some((a) => d(a.qty).times(d(a.price)).gt(0));
}

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

/**
 * Dasar perhitungan PB1.
 *
 * Sama bentuknya dengan dasar service charge: hanya baris yang ditandai dan
 * bukan compliment yang ikut. Sebelumnya PB1 dihitung dari SELURUH subtotal,
 * tanpa bisa dikecualikan per baris — padahal tidak semua yang dijual
 * katering termasuk objek PB1.
 *
 * charge_pb1 dianggap true bila tidak diisi, sama seperti charge_service.
 * Itu yang membuat dokumen lama — yang seluruhnya kena PB1 — tetap
 * menghasilkan angka yang sama persis.
 */
export function dasarPb1(items: BarisItem[]): Decimal {
  return items
    .filter((item) => (item.charge_pb1 ?? true) && !item.is_compliment)
    .reduce((jumlah, item) => jumlah.plus(d(item.qty).times(d(item.price))), new Decimal(0));
}

/* -------------------------------------------------------------------------
   TOTAL DOKUMEN (quotation & invoice memakai rumus yang sama persis)
   ------------------------------------------------------------------------- */

export type MasukanTotal = {
  items: BarisBerAnak[];
  /** Persen service charge. Kosong atau nol berarti tidak dikenakan. */
  service_charge_percent?: NilaiUang;
  /** PB1 hanya dihitung bila dinyalakan pada dokumen ini. */
  pb1_enabled?: boolean;
  pb1_percent?: NilaiUang;
  /**
   * Ongkos pengantaran.
   *
   * Ditambahkan ke total TETAPI tidak pernah masuk dasar service charge
   * maupun PB1 — ia ongkos kirim, bukan bagian dari nilai makanan yang
   * dipajaki. Itu sebabnya ia tidak bisa sekadar menjadi baris item:
   * PB1 dihitung dari subtotal, jadi delivery akan ikut terpajaki.
   */
  delivery_amount?: NilaiUang;
  /**
   * Biaya tambahan bernama, di luar service charge maupun PB1.
   *
   * Kedudukannya sama persis dengan delivery — ditambahkan paling akhir dan
   * tidak pernah masuk dasar pungutan apa pun. Bedanya namanya bebas dan
   * jumlahnya boleh lebih dari satu, karena dokumen katering sungguhan
   * memuat baris seperti "Tim Servis utk Menu Buffet (1 orang)" dan
   * "Tambahan Set-up & Layanan 1 Titik VIP Buffet" yang tidak mungkin
   * ditebak sebelumnya.
   *
   * Tidak bisa diganti baris item biasa: baris item masuk subtotal, dan
   * subtotal adalah dasar service charge maupun PB1.
   */
  biaya_tambahan?: BarisTambahan[];
};

/** Satu baris biaya tambahan: namanya dan jumlahnya. */
export type BarisTambahan = {
  label?: string;
  amount?: NilaiUang;
};

export function totalBiayaTambahan(baris: BarisTambahan[] | undefined): Decimal {
  return (baris ?? []).reduce((jumlah, b) => jumlah.plus(d(b.amount)), new Decimal(0));
}

export type HasilTotal = {
  subtotal: Decimal;
  dasar_service_charge: Decimal;
  service_charge_amount: Decimal;
  dasar_pb1: Decimal;
  pb1_amount: Decimal;
  delivery_amount: Decimal;
  biaya_tambahan_amount: Decimal;
  grand_total: Decimal;
};

export function hitungTotalDokumen(masukan: MasukanTotal): HasilTotal {
  // Diratakan DI SINI, bukan oleh pemanggilnya. Sub-item berharga yang
  // terlewat tidak menghasilkan galat apa pun — hanya total yang diam-diam
  // kurang, dan itu baru ketahuan setelah dokumennya dikirim.
  const baris = ratakanBaris(masukan.items);

  const subtotal = hitungSubtotal(baris);
  const dasar = dasarServiceCharge(baris);

  // Laravel: $this->service_charge_percent ? round(...) : 0
  // Di PHP, "0" dan "" sama-sama falsy, jadi persen nol berarti tidak dikenakan.
  const persenSc = d(masukan.service_charge_percent);
  const service_charge_amount = persenSc.isZero()
    ? new Decimal(0)
    : bulatkanRupiah(dasar.times(persenSc).dividedBy(100));

  // PB1 dihitung dari baris yang DITANDAI, bukan dari seluruh subtotal, dan
  // tetap bukan dari subtotal + service charge.
  const dasarPajak = dasarPb1(baris);
  const pb1_amount = masukan.pb1_enabled
    ? bulatkanRupiah(dasarPajak.times(d(masukan.pb1_percent)).dividedBy(100))
    : new Decimal(0);

  // Delivery dan biaya tambahan ditambahkan PALING AKHIR, setelah kedua
  // pungutan dihitung. Urutan ini yang membuat keduanya bebas dari service
  // charge dan PB1 — bukan sekadar kebiasaan penulisan.
  const delivery_amount = d(masukan.delivery_amount);
  const biaya_tambahan_amount = totalBiayaTambahan(masukan.biaya_tambahan);

  return {
    subtotal,
    dasar_service_charge: dasar,
    service_charge_amount,
    dasar_pb1: dasarPajak,
    pb1_amount,
    delivery_amount,
    biaya_tambahan_amount,
    grand_total: subtotal
      .plus(service_charge_amount)
      .plus(pb1_amount)
      .plus(delivery_amount)
      .plus(biaya_tambahan_amount),
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
 * Penjualan yang diakui adalah SELURUH nilai yang ditagihkan — subtotal,
 * service charge, delivery, dan PB1 — yaitu grand total invoice. Itulah uang
 * yang benar-benar diminta dari customer.
 *
 * Sebelumnya hanya subtotal yang diakui, dengan alasan PB1 diteruskan ke
 * pemerintah. Cara itu memaksa satu asumsi: bahwa PB1 SELALU disetorkan.
 * Padahal tidak setiap acara begitu, dan asumsi yang dipaksakan di dalam
 * rumus tidak bisa dikoreksi oleh siapa pun yang memakai laporannya.
 *
 * Sekarang penyetoran PB1 dicatat sebagai BARIS BIAYA berkategori "PB1",
 * sehingga keadaan sebenarnya yang menentukan:
 *
 *   PB1 disetorkan       -> dicatat sebagai biaya, dan margin kembali
 *                           sama persis seperti aturan lama
 *   PB1 tidak disetorkan -> tidak ada baris biayanya, dan PB1 terbaca
 *                           sebagai bagian dari margin
 *
 * Konsekuensinya harus disadari: PB1 yang tidak dicatat sebagai biaya akan
 * terlihat sebagai untung. Kalau suatu saat ia tetap harus disetorkan,
 * untung itu ikut hilang bersamanya.
 */
export function hitungMargin(argumen: {
  /** Seluruh nilai yang ditagihkan — grand total invoice. */
  penjualan: NilaiUang;
  biaya: BarisBiaya[];
}): HasilMargin {
  const net_sales = d(argumen.penjualan);
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

/* -------------------------------------------------------------------------
   TOTAL PER KELOMPOK
   ------------------------------------------------------------------------- */

/** Satu baris bernomor Romawi beserta sub-itemnya, apa adanya dari database. */
export type KelompokDokumen = {
  subtotal: NilaiUang;
  anak: { subtotal: NilaiUang }[];
};

/**
 * Nilai satu kelompok: baris induknya ditambah seluruh sub-itemnya.
 *
 * Kedua bentuk tertampung oleh satu penjumlahan yang sama. Pada paket
 * berharga, angkanya ada di induknya dan sub-itemnya nol. Pada judul
 * kelompok, induknya nol dan angkanya ada di sub-itemnya.
 */
export function nilaiKelompok(k: KelompokDokumen): Decimal {
  return k.anak.reduce((jumlah, a) => jumlah.plus(d(a.subtotal)), d(k.subtotal));
}

/**
 * Apakah kelompok ini perlu baris "Total - I"?
 *
 * Hanya kalau ada angkanya. Kelompok seperti "STALL/ GUBUKAN - Menu dari
 * Luar" yang isinya cuma daftar nama tidak menagih apa pun, dan baris
 * "Total - II  Rp 0" di bawahnya hanya membuat pembacanya berhenti
 * mencari-cari apa yang berharga nol.
 *
 * Baris tanpa sub-item juga tidak diberi total: nilainya sudah tertulis di
 * baris itu sendiri, dan mengulanginya tepat di bawahnya tidak menambah
 * apa pun.
 */
export function perluTotalKelompok(k: KelompokDokumen): boolean {
  return k.anak.length > 0 && nilaiKelompok(k).gt(0);
}
