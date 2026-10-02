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

     BELUM TERJADI, dibayar SEBAGIAN     -> UANG MUKA
       Yang dicatat sebagai uang muka adalah uang yang BENAR-BENAR MASUK.
       Sisanya belum dibayar dan belum pula menjadi piutang.

     BELUM TERJADI, sudah LUNAS          -> PENDAPATAN DITERIMA DI MUKA
       Seluruh nilainya sudah di tangan, tetapi belum boleh diakui sebagai
       penghasilan: kalau acaranya batal, uang itu harus dikembalikan.

     BELUM TERJADI, belum dibayar        -> PROYEKSI PENJUALAN
       Dokumennya sudah dibuat, tetapi belum ada apa pun yang terjadi dan
       belum ada uang yang masuk.

   UANG MUKA DAN DITERIMA DI MUKA SENGAJA DIPISAH. Keduanya sama-sama uang
   yang belum boleh diakui, tetapi kewajibannya berbeda: yang lunas sudah
   tidak perlu ditagih lagi, yang baru panjar masih menyisakan tagihan yang
   harus ditagih sebelum acaranya berjalan. Menggabungkannya menyembunyikan
   perbedaan itu.

   KELIMA ANGKANYA SELALU BERJUMLAH SAMA dengan nilai dokumennya, berapa pun
   keadaannya. Itu yang membuat laporannya tidak bisa kehilangan angka.
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
  /** Panjar yang sudah masuk untuk acara yang belum terjadi dan belum lunas. */
  uangMuka: Decimal;
  /** Sisa tagihan pada dokumen beruang muka. Bukan piutang, belum pula penjualan. */
  sisaUangMuka: Decimal;
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
    sisaUangMuka: NOL,
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

  return {
    ...kosong,
    keadaan: "uang_muka",
    sudahTerjadi: false,
    uangMuka: dibayar,
    sisaUangMuka: total.minus(dibayar),
  };
}

export type RingkasanPengakuan = {
  diakui: Decimal;
  piutang: Decimal;
  uangMuka: Decimal;
  sisaUangMuka: Decimal;
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
        sisaUangMuka: jumlah.sisaUangMuka.plus(p.sisaUangMuka),
        diterimaDiMuka: jumlah.diterimaDiMuka.plus(p.diterimaDiMuka),
        proyeksi: jumlah.proyeksi.plus(p.proyeksi),
      };
    },
    {
      diakui: NOL,
      piutang: NOL,
      uangMuka: NOL,
      sisaUangMuka: NOL,
      diterimaDiMuka: NOL,
      proyeksi: NOL,
    },
  );
}

export const LABEL_PENGAKUAN: Record<KeadaanPengakuan, string> = {
  diakui: "Penjualan",
  uang_muka: "Uang muka",
  diterima_di_muka: "Diterima di muka",
  proyeksi: "Proyeksi",
};
