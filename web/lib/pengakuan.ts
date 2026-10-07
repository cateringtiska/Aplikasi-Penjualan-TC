import { Decimal } from "decimal.js";

import { d, type NilaiUang } from "./uang";

/* ==========================================================================
   KAPAN PENJUALAN DIAKUI

   Patokannya TANGGAL ACARA, bukan tanggal invoice. Katering menjual jasa
   yang baru terjadi pada hari acaranya; sebelum itu belum ada apa pun yang
   diserahkan, jadi belum ada penjualan.

   Empat keadaan, persis seperti yang ditetapkan pemiliknya:

     ACARA SUDAH SELESAI                 -> PENJUALAN
       Seluruh nilainya diakui. Yang belum dibayar menjadi PIUTANG — dan
       inilah satu-satunya keadaan yang menghasilkan piutang. Menagih
       sesuatu yang belum diserahkan bukan piutang.

     BELUM TERJADI, dibayar SEBAGIAN     -> UANG MUKA + PROYEKSI
       Uang muka mencatat uang yang BENAR-BENAR MASUK. Nilai penjualannya —
       seluruhnya, bukan sisanya — tetap masuk proyeksi, karena belum satu
       rupiah pun boleh diakui sebagai penjualan.

     BELUM TERJADI, sudah LUNAS          -> PENDAPATAN DITERIMA DI MUKA
       Seluruh nilainya sudah di tangan, tetapi belum boleh diakui sebagai
       penghasilan: kalau acaranya batal, uang itu harus dikembalikan.

     BELUM TERJADI, belum dibayar        -> PROYEKSI PENJUALAN
       Dokumennya sudah dibuat, tetapi belum ada apa pun yang terjadi dan
       belum ada uang yang masuk.

   UANG MUKA DAN DITERIMA DI MUKA SENGAJA DIPISAH. Keduanya sama-sama uang
   yang belum boleh diakui, tetapi kewajibannya berbeda: yang lunas sudah
   tidak perlu ditagih lagi, yang baru panjar masih menyisakan tagihan yang
   harus ditagih sebelum acaranya berjalan.

   UANG MUKA TUMPANG TINDIH DENGAN PROYEKSI, DAN ITU DISENGAJA. Keduanya
   menjawab pertanyaan yang berbeda:

     proyeksi   berapa NILAI PENJUALAN yang belum boleh diakui
     uang muka  berapa UANGNYA yang sudah ada di tangan

   Invoice 42,9 juta untuk acara bulan depan yang sudah dipanjar 10 juta
   adalah 42,9 juta proyeksi DAN 10 juta uang muka. Keduanya benar, dan
   keduanya TIDAK BOLEH DIJUMLAHKAN — penjumlahan itu menghitung panjarnya
   dua kali.

   Yang berjumlah sama dengan seluruh nilai dokumen adalah DIAKUI +
   DITERIMA DI MUKA + PROYEKSI. Itu yang membuat laporannya tidak bisa
   kehilangan angka.
   ========================================================================== */

export type KeadaanPengakuan = "diakui" | "uang_muka" | "diterima_di_muka" | "proyeksi";

export type DokumenPengakuan = {
  grand_total: NilaiUang;
  paid_amount: NilaiUang;
  /** Seluruh tanggal acara. Kosong berarti dokumen tanpa tanggal acara. */
  tanggalAcara: Date[];
};

export type HasilPengakuan = {
  keadaan: KeadaanPengakuan;
  sudahTerjadi: boolean;
  /** Penjualan yang diakui. Nol selama acaranya belum terjadi. */
  diakui: Decimal;
  /** Piutang sungguhan — hanya dari acara yang sudah terjadi. */
  piutang: Decimal;
  /**
   * Panjar yang sudah masuk untuk acara yang belum terjadi dan belum lunas.
   * TUMPANG TINDIH dengan proyeksi — jangan dijumlahkan dengannya.
   */
  uangMuka: Decimal;
  /** Nilai penuh dokumen yang sudah LUNAS tetapi acaranya belum terjadi. */
  diterimaDiMuka: Decimal;
  /** Nilai dokumen yang belum dibayar sama sekali dan acaranya belum terjadi. */
  proyeksi: Decimal;
};

const NOL = new Decimal(0);

/** Awal hari, supaya acara hari ini tidak terbaca "belum terjadi". */
function awalHari(waktu: Date): Date {
  const t = new Date(waktu);
  t.setHours(0, 0, 0, 0);
  return t;
}

/**
 * Apakah acaranya sudah terjadi?
 *
 * Dinilai dari tanggal TERAKHIR. Acara 10-12 Mei baru selesai tanggal 12;
 * memakai tanggal pertama akan mengakui penjualan dua hari sebelum
 * makanannya diantar.
 *
 * Acara yang berlangsung HARI INI dihitung sudah terjadi. Makanannya diantar
 * hari itu juga, dan menunda pengakuannya sampai besok hanya membuat angka
 * hari ini selalu tertinggal sehari.
 *
 * DOKUMEN TANPA TANGGAL ACARA dianggap sudah terjadi. Itu mempertahankan
 * perilaku sebelum aturan ini ada: tanpa tanggal, tidak ada dasar untuk
 * menunda, dan menahan seluruh dokumen lama di luar laporan akan membuat
 * angkanya mendadak kosong tanpa sebab yang bisa dijelaskan.
 */
export function acaraSudahTerjadi(tanggalAcara: Date[], sekarang = new Date()): boolean {
  const sah = tanggalAcara.filter((t) => t instanceof Date && !Number.isNaN(t.getTime()));
  if (sah.length === 0) return true;

  const terakhir = sah.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
  return awalHari(terakhir).getTime() <= awalHari(sekarang).getTime();
}

export function pengakuanDokumen(
  dokumen: DokumenPengakuan,
  sekarang = new Date(),
): HasilPengakuan {
  const total = d(dokumen.grand_total);
  // Dibatasi nilai dokumennya: pembayaran berlebih tidak boleh menghasilkan
  // sisa yang minus.
  const dibayar = Decimal.min(d(dokumen.paid_amount), total);
  const sudahTerjadi = acaraSudahTerjadi(dokumen.tanggalAcara, sekarang);

  const kosong = {
    diakui: NOL,
    piutang: NOL,
    uangMuka: NOL,
    diterimaDiMuka: NOL,
    proyeksi: NOL,
  };

  if (sudahTerjadi) {
    return {
      ...kosong,
      keadaan: "diakui",
      sudahTerjadi: true,
      diakui: total,
      piutang: total.minus(dibayar),
    };
  }

  if (dibayar.lte(0)) {
    return { ...kosong, keadaan: "proyeksi", sudahTerjadi: false, proyeksi: total };
  }

  if (dibayar.gte(total)) {
    return {
      ...kosong,
      keadaan: "diterima_di_muka",
      sudahTerjadi: false,
      diterimaDiMuka: total,
    };
  }

  // Nilai penjualannya SELURUHNYA masuk proyeksi, bukan sisanya: belum satu
  // rupiah pun boleh diakui sebagai penjualan selama acaranya belum terjadi.
  return {
    ...kosong,
    keadaan: "uang_muka",
    sudahTerjadi: false,
    uangMuka: dibayar,
    proyeksi: total,
  };
}

export type RingkasanPengakuan = {
  diakui: Decimal;
  piutang: Decimal;
  /** Tumpang tindih dengan proyeksi. Jangan dijumlahkan dengannya. */
  uangMuka: Decimal;
  diterimaDiMuka: Decimal;
  proyeksi: Decimal;
};

export function ringkasPengakuan(
  dokumen: DokumenPengakuan[],
  sekarang = new Date(),
): RingkasanPengakuan {
  return dokumen.reduce<RingkasanPengakuan>(
    (jumlah, satu) => {
      const p = pengakuanDokumen(satu, sekarang);
      return {
        diakui: jumlah.diakui.plus(p.diakui),
        piutang: jumlah.piutang.plus(p.piutang),
        uangMuka: jumlah.uangMuka.plus(p.uangMuka),
        diterimaDiMuka: jumlah.diterimaDiMuka.plus(p.diterimaDiMuka),
        proyeksi: jumlah.proyeksi.plus(p.proyeksi),
      };
    },
    { diakui: NOL, piutang: NOL, uangMuka: NOL, diterimaDiMuka: NOL, proyeksi: NOL },
  );
}

export const LABEL_PENGAKUAN: Record<KeadaanPengakuan, string> = {
  diakui: "Penjualan",
  uang_muka: "Uang muka",
  diterima_di_muka: "Diterima di muka",
  proyeksi: "Proyeksi",
};

/* ==========================================================================
   MENYARING DAFTAR MENURUT KARTU DASHBOARD

   Tiap kartu di Dashboard bisa diklik, dan membuka daftar invoice yang
   dihitungnya. Angka di kartu dan banyaknya baris di daftar itu HARUS SAMA.

   Kalau keduanya menyaring sendiri-sendiri, perbedaannya tidak akan
   menimbulkan galat apa pun: kartunya tetap menyebut sebelas, daftarnya
   tetap terbuka berisi sembilan, dan tidak ada yang tahu mana yang benar.
   Yang membukanya justru sedang mencari dokumen yang hilang itu.

   Jadi keputusannya diambil SEKALI di sini, dan dipakai keduanya.
   ========================================================================== */

export const SARING_PENGAKUAN = [
  "piutang",
  "diakui-bulan-ini",
  "uang-muka",
  "diterima-di-muka",
  "proyeksi",
  "jatuh-tempo",
] as const;

export type SaringPengakuan = (typeof SARING_PENGAKUAN)[number];

export function saringPengakuanSah(nilai: string): nilai is SaringPengakuan {
  return (SARING_PENGAKUAN as readonly string[]).includes(nilai);
}

export const LABEL_SARING_PENGAKUAN: Record<SaringPengakuan, string> = {
  piutang: "Piutang berjalan",
  "diakui-bulan-ini": "Penjualan diakui bulan ini",
  "uang-muka": "Uang muka",
  "diterima-di-muka": "Diterima di muka",
  proyeksi: "Proyeksi penjualan",
  "jatuh-tempo": "Jatuh tempo",
};

export type BarisPengakuan = {
  hasil: HasilPengakuan;
  dueDate: Date;
  /** Tanggal acara paling akhir, null kalau dokumennya tidak bertanggal. */
  acaraTerakhir: Date | null;
};

/** Awal bulan dan awal bulan depan dari satu saat. */
export function rentangBulan(sekarang: Date): { awal: Date; akhir: Date } {
  return {
    awal: new Date(sekarang.getFullYear(), sekarang.getMonth(), 1),
    akhir: new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 1),
  };
}

/**
 * Apakah satu dokumen termasuk hitungan kartu ini.
 *
 * Dipakai Dashboard untuk MENGHITUNG dan daftar invoice untuk MENYARING.
 */
export function cocokSaringPengakuan(
  saring: SaringPengakuan,
  baris: BarisPengakuan,
  sekarang = new Date(),
): boolean {
  const { awal, akhir } = rentangBulan(sekarang);

  switch (saring) {
    case "piutang":
      return baris.hasil.piutang.gt(0);

    case "diakui-bulan-ini":
      return (
        baris.hasil.sudahTerjadi &&
        baris.acaraTerakhir !== null &&
        baris.acaraTerakhir >= awal &&
        baris.acaraTerakhir < akhir
      );

    case "uang-muka":
      return baris.hasil.keadaan === "uang_muka";

    case "diterima-di-muka":
      return baris.hasil.keadaan === "diterima_di_muka";

    case "proyeksi":
      return baris.hasil.keadaan === "proyeksi";

    case "jatuh-tempo":
      // Dihitung dari due_date, bukan dari kolom status: kolom status adalah
      // salinan yang perlu disegarkan, tanggalnya adalah sumbernya.
      return baris.hasil.piutang.gt(0) && baris.dueDate < awalHari(sekarang);
  }
}
