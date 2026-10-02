import { Decimal } from "decimal.js";

import { d, type NilaiUang } from "./uang";

/* ==========================================================================
   KAPAN PENJUALAN DIAKUI

   Patokannya TANGGAL ACARA, bukan tanggal invoice. Katering menjual jasa
   yang baru terjadi pada hari acaranya; sebelum itu belum ada apa pun yang
   diserahkan, jadi belum ada penjualan.

   Satu dokumen jatuh ke salah satu dari tiga keadaan:

     ACARANYA SUDAH TERJADI
       Seluruh nilainya menjadi PENJUALAN DIAKUI, dan yang belum dibayar
       menjadi PIUTANG. Inilah satu-satunya keadaan yang menghasilkan
       piutang — menagih sesuatu yang belum diserahkan bukan piutang.

     ACARANYA BELUM TERJADI, uangnya sudah masuk
       Yang sudah diterima menjadi PENDAPATAN DITERIMA DI MUKA. Ia utang,
       bukan penghasilan: kalau acaranya batal, uang itu harus dikembalikan.

     ACARANYA BELUM TERJADI, uangnya belum masuk
       Sisanya menjadi PROYEKSI PENJUALAN. Belum ada apa pun yang terjadi,
       dan belum ada uang yang diterima.

   SATU DOKUMEN BISA MASUK DUA KERANJANG. Invoice 100 juta untuk acara bulan
   depan yang sudah dibayar muka 10 juta adalah 10 juta pendapatan diterima
   di muka DAN 90 juta proyeksi. Memasukkan seluruh 100 juta ke pendapatan
   diterima di muka akan mengakui uang yang belum diterima siapa pun —
   padahal nama pos itu sendiri berarti uang yang sudah diterima.

   Ketiganya selalu berjumlah sama dengan nilai dokumennya, berapa pun
   keadaannya. Itu yang membuat laporannya tidak bisa kehilangan angka.
   ========================================================================== */

export type KeadaanPengakuan = "diakui" | "ditangguhkan" | "proyeksi";

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
  /** Uang yang sudah diterima untuk acara yang belum terjadi. */
  ditangguhkan: Decimal;
  /** Nilai yang belum diterima untuk acara yang belum terjadi. */
  proyeksi: Decimal;
};

/** Awal hari ini, supaya acara hari ini tidak terbaca "belum terjadi". */
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
  const dibayar = d(dokumen.paid_amount);
  const sudahTerjadi = acaraSudahTerjadi(dokumen.tanggalAcara, sekarang);

  if (sudahTerjadi) {
    return {
      keadaan: "diakui",
      sudahTerjadi: true,
      diakui: total,
      // Dibatasi nol: pembayaran berlebih bukan piutang minus.
      piutang: Decimal.max(total.minus(dibayar), 0),
      ditangguhkan: new Decimal(0),
      proyeksi: new Decimal(0),
    };
  }

  // Yang sudah diterima tidak boleh melebihi nilai dokumennya; sisanya nol,
  // bukan proyeksi minus.
  const ditangguhkan = Decimal.min(dibayar, total);

  return {
    keadaan: ditangguhkan.gt(0) ? "ditangguhkan" : "proyeksi",
    sudahTerjadi: false,
    diakui: new Decimal(0),
    piutang: new Decimal(0),
    ditangguhkan,
    proyeksi: Decimal.max(total.minus(ditangguhkan), 0),
  };
}

export type RingkasanPengakuan = {
  diakui: Decimal;
  piutang: Decimal;
  ditangguhkan: Decimal;
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
        ditangguhkan: jumlah.ditangguhkan.plus(p.ditangguhkan),
        proyeksi: jumlah.proyeksi.plus(p.proyeksi),
      };
    },
    { diakui: new Decimal(0), piutang: new Decimal(0), ditangguhkan: new Decimal(0), proyeksi: new Decimal(0) },
  );
}

export const LABEL_PENGAKUAN: Record<KeadaanPengakuan, string> = {
  diakui: "Diakui",
  ditangguhkan: "Diterima di muka",
  proyeksi: "Proyeksi",
};
