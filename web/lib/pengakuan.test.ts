import { describe, expect, it } from "vitest";

import { acaraSudahTerjadi, pengakuanDokumen, ringkasPengakuan } from "./pengakuan";

/* ==========================================================================
   KAPAN PENJUALAN DIAKUI

   Patokannya tanggal acara, bukan tanggal invoice. Salah di sini tidak
   membuat apa pun gagal — laporannya tetap terbit, hanya mengaku punya
   penghasilan yang belum terjadi, atau piutang atas sesuatu yang belum
   diserahkan. Angka seperti itu dipakai memutuskan hal-hal yang sulit
   ditarik kembali.
   ========================================================================== */

const HARI_INI = new Date("2026-10-06T10:00:00");
const tgl = (teks: string) => new Date(`${teks}T00:00:00`);

const dok = (
  total: string,
  dibayar: string,
  tanggalAcara: Date[] = [],
) => ({ grand_total: total, paid_amount: dibayar, tanggalAcara });

describe("acaraSudahTerjadi", () => {
  it("memakai tanggal TERAKHIR, bukan yang pertama", () => {
    // Acara 5-8 Oktober belum selesai pada tanggal 6. Memakai tanggal
    // pertama akan mengakui penjualannya dua hari sebelum makanan diantar.
    const acara = [tgl("2026-10-05"), tgl("2026-10-07"), tgl("2026-10-08")];
    expect(acaraSudahTerjadi(acara, HARI_INI)).toBe(false);
  });

  it("menghitung acara HARI INI sebagai sudah terjadi", () => {
    expect(acaraSudahTerjadi([tgl("2026-10-06")], HARI_INI)).toBe(true);
  });

  it("acara kemarin sudah terjadi, acara besok belum", () => {
    expect(acaraSudahTerjadi([tgl("2026-10-05")], HARI_INI)).toBe(true);
    expect(acaraSudahTerjadi([tgl("2026-10-07")], HARI_INI)).toBe(false);
  });

  it("dokumen TANPA tanggal acara dianggap sudah terjadi", () => {
    // Mempertahankan perilaku sebelum aturan ini ada. Menahan seluruh
    // dokumen lama di luar laporan akan membuat angkanya mendadak kosong.
    expect(acaraSudahTerjadi([], HARI_INI)).toBe(true);
  });
});

describe("pengakuanDokumen", () => {
  it("acara yang sudah terjadi: seluruhnya diakui, sisanya jadi piutang", () => {
    const p = pengakuanDokumen(dok("10000000", "4000000", [tgl("2026-10-01")]), HARI_INI);

    expect(p.keadaan).toBe("diakui");
    expect(p.diakui.toString()).toBe("10000000");
    expect(p.piutang.toString()).toBe("6000000");
    expect(p.uangMuka.toString()).toBe("0");
    expect(p.diterimaDiMuka.toString()).toBe("0");
    expect(p.proyeksi.toString()).toBe("0");
  });

  it("acara yang BELUM terjadi TIDAK PERNAH menghasilkan piutang", () => {
    // Inti aturannya. Menagih sesuatu yang belum diserahkan bukan piutang,
    // dan memasukkannya ke piutang membuat umur piutang terbaca lebih buruk
    // daripada keadaan sebenarnya.
    for (const dibayar of ["0", "3000000", "10000000"]) {
      const p = pengakuanDokumen(dok("10000000", dibayar, [tgl("2026-11-01")]), HARI_INI);
      expect(p.piutang.toString(), `dibayar ${dibayar}`).toBe("0");
      expect(p.diakui.toString(), `dibayar ${dibayar}`).toBe("0");
    }
  });

  it("belum terjadi dan belum dibayar sama sekali: PROYEKSI", () => {
    const p = pengakuanDokumen(dok("10000000", "0", [tgl("2026-11-01")]), HARI_INI);

    expect(p.keadaan).toBe("proyeksi");
    expect(p.proyeksi.toString()).toBe("10000000");
  });

  it("belum terjadi dan dibayar SEBAGIAN: uang muka DAN proyeksi penuh", () => {
    // Dua ukuran yang berbeda, dan keduanya benar sekaligus:
    //   uang muka  berapa uangnya yang sudah ada di tangan
    //   proyeksi   berapa nilai penjualan yang belum boleh diakui
    // Nilai penjualannya SELURUHNYA, bukan sisanya — belum satu rupiah pun
    // boleh diakui selama acaranya belum terjadi.
    const p = pengakuanDokumen(dok("42900000", "10000000", [tgl("2026-11-01")]), HARI_INI);

    expect(p.keadaan).toBe("uang_muka");
    expect(p.uangMuka.toString()).toBe("10000000");
    expect(p.proyeksi.toString()).toBe("42900000");
    expect(p.diterimaDiMuka.toString()).toBe("0");
    expect(p.diakui.toString()).toBe("0");
  });

  it("belum terjadi dan sudah LUNAS: PENDAPATAN DITERIMA DI MUKA", () => {
    // Dibedakan dari uang muka dengan sengaja: yang lunas sudah tidak perlu
    // ditagih lagi, yang baru panjar masih menyisakan tagihan.
    const p = pengakuanDokumen(dok("10000000", "10000000", [tgl("2026-11-01")]), HARI_INI);

    expect(p.keadaan).toBe("diterima_di_muka");
    expect(p.diterimaDiMuka.toString()).toBe("10000000");
    expect(p.uangMuka.toString()).toBe("0");
    expect(p.proyeksi.toString()).toBe("0");
  });

  it("SATU RUPIAH dari lunas sudah cukup membedakan keduanya", () => {
    const kurangSerupiah = pengakuanDokumen(dok("10000000", "9999999", [tgl("2026-11-01")]), HARI_INI);
    expect(kurangSerupiah.keadaan).toBe("uang_muka");
    expect(kurangSerupiah.proyeksi.toString()).toBe("10000000");

    const pas = pengakuanDokumen(dok("10000000", "10000000", [tgl("2026-11-01")]), HARI_INI);
    expect(pas.keadaan).toBe("diterima_di_muka");
  });

  it("diakui + diterima di muka + proyeksi SELALU sama dengan nilai dokumennya", () => {
    // Itu yang membuat laporannya tidak bisa kehilangan angka.
    const contoh = [
      dok("10000000", "0", [tgl("2026-10-01")]),
      dok("10000000", "4000000", [tgl("2026-10-01")]),
      dok("10000000", "10000000", [tgl("2026-10-01")]),
      dok("10000000", "0", [tgl("2026-11-01")]),
      dok("10000000", "3000000", [tgl("2026-11-01")]),
      dok("10000000", "10000000", [tgl("2026-11-01")]),
      dok("10000000", "0", []),
    ];

    for (const satu of contoh) {
      const p = pengakuanDokumen(satu, HARI_INI);
      // Uang muka SENGAJA tidak ikut: ia tumpang tindih dengan proyeksi,
      // dan menjumlahkannya akan menghitung panjarnya dua kali.
      const jumlah = p.diakui.plus(p.diterimaDiMuka).plus(p.proyeksi);
      expect(jumlah.toString(), JSON.stringify(satu)).toBe("10000000");
    }
  });

  it("pembayaran berlebih tidak menghasilkan angka minus", () => {
    const sudah = pengakuanDokumen(dok("10000000", "12000000", [tgl("2026-10-01")]), HARI_INI);
    expect(sudah.piutang.toString()).toBe("0");

    const belum = pengakuanDokumen(dok("10000000", "12000000", [tgl("2026-11-01")]), HARI_INI);
    expect(belum.keadaan).toBe("diterima_di_muka");
    expect(belum.diterimaDiMuka.toString()).toBe("10000000");
    expect(belum.proyeksi.toString()).toBe("0");
  });
});

describe("ringkasPengakuan", () => {
  it("menjumlahkan beberapa dokumen ke keranjangnya masing-masing", () => {
    const hasil = ringkasPengakuan(
      [
        dok("10000000", "4000000", [tgl("2026-10-01")]), // diakui 10jt, piutang 6jt
        dok("20000000", "5000000", [tgl("2026-12-01")]), // uang muka 5jt, proyeksi 20jt
        dok("30000000", "30000000", [tgl("2026-12-20")]), // diterima di muka 30jt
        dok("40000000", "0", [tgl("2026-12-24")]), // proyeksi 40jt
      ],
      HARI_INI,
    );

    expect(hasil.diakui.toString()).toBe("10000000");
    expect(hasil.piutang.toString()).toBe("6000000");
    expect(hasil.uangMuka.toString()).toBe("5000000");
    expect(hasil.diterimaDiMuka.toString()).toBe("30000000");
    // 20 juta (dipanjar, seluruh nilainya) + 40 juta (belum dibayar)
    expect(hasil.proyeksi.toString()).toBe("60000000");
  });

  it("daftar kosong menghasilkan nol, bukan galat", () => {
    const hasil = ringkasPengakuan([], HARI_INI);
    expect(hasil.diakui.toString()).toBe("0");
    expect(hasil.proyeksi.toString()).toBe("0");
  });
});
