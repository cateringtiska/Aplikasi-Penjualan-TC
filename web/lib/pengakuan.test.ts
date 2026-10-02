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
    expect(p.ditangguhkan.toString()).toBe("0");
    expect(p.proyeksi.toString()).toBe("0");
  });

  it("acara yang BELUM terjadi TIDAK menghasilkan piutang", () => {
    // Inti aturannya. Menagih sesuatu yang belum diserahkan bukan piutang,
    // dan memasukkannya ke piutang membuat umur piutang terbaca lebih buruk
    // daripada keadaan sebenarnya.
    const p = pengakuanDokumen(dok("10000000", "0", [tgl("2026-11-01")]), HARI_INI);

    expect(p.piutang.toString()).toBe("0");
    expect(p.diakui.toString()).toBe("0");
    expect(p.keadaan).toBe("proyeksi");
    expect(p.proyeksi.toString()).toBe("10000000");
  });

  it("SATU DOKUMEN BISA MASUK DUA KERANJANG", () => {
    // Invoice 100 juta untuk acara bulan depan, dibayar muka 10 juta.
    // Memasukkan seluruh 100 juta ke pendapatan diterima di muka akan
    // mengakui uang yang belum diterima siapa pun.
    const p = pengakuanDokumen(dok("100000000", "10000000", [tgl("2026-11-01")]), HARI_INI);

    expect(p.keadaan).toBe("ditangguhkan");
    expect(p.ditangguhkan.toString()).toBe("10000000");
    expect(p.proyeksi.toString()).toBe("90000000");
    expect(p.piutang.toString()).toBe("0");
    expect(p.diakui.toString()).toBe("0");
  });

  it("acara belum terjadi dan lunas: seluruhnya diterima di muka", () => {
    const p = pengakuanDokumen(dok("10000000", "10000000", [tgl("2026-11-01")]), HARI_INI);

    expect(p.ditangguhkan.toString()).toBe("10000000");
    expect(p.proyeksi.toString()).toBe("0");
  });

  it("keempat angkanya SELALU berjumlah sama dengan nilai dokumennya", () => {
    // Itu yang membuat laporannya tidak bisa kehilangan angka.
    const contoh = [
      dok("10000000", "0", [tgl("2026-10-01")]),
      dok("10000000", "4000000", [tgl("2026-10-01")]),
      dok("10000000", "0", [tgl("2026-11-01")]),
      dok("10000000", "3000000", [tgl("2026-11-01")]),
      dok("10000000", "10000000", [tgl("2026-11-01")]),
      dok("10000000", "0", []),
    ];

    for (const satu of contoh) {
      const p = pengakuanDokumen(satu, HARI_INI);
      const jumlah = p.diakui.plus(p.ditangguhkan).plus(p.proyeksi);
      expect(jumlah.toString(), JSON.stringify(satu)).toBe("10000000");
    }
  });

  it("pembayaran berlebih tidak menghasilkan angka minus", () => {
    const sudah = pengakuanDokumen(dok("10000000", "12000000", [tgl("2026-10-01")]), HARI_INI);
    expect(sudah.piutang.toString()).toBe("0");

    const belum = pengakuanDokumen(dok("10000000", "12000000", [tgl("2026-11-01")]), HARI_INI);
    expect(belum.ditangguhkan.toString()).toBe("10000000");
    expect(belum.proyeksi.toString()).toBe("0");
  });
});

describe("ringkasPengakuan", () => {
  it("menjumlahkan beberapa dokumen ke keranjangnya masing-masing", () => {
    const hasil = ringkasPengakuan(
      [
        dok("10000000", "4000000", [tgl("2026-10-01")]), // diakui 10jt, piutang 6jt
        dok("20000000", "5000000", [tgl("2026-12-01")]), // muka 5jt, proyeksi 15jt
        dok("30000000", "0", [tgl("2026-12-24")]), // proyeksi 30jt
      ],
      HARI_INI,
    );

    expect(hasil.diakui.toString()).toBe("10000000");
    expect(hasil.piutang.toString()).toBe("6000000");
    expect(hasil.ditangguhkan.toString()).toBe("5000000");
    expect(hasil.proyeksi.toString()).toBe("45000000");
  });

  it("daftar kosong menghasilkan nol, bukan galat", () => {
    const hasil = ringkasPengakuan([], HARI_INI);
    expect(hasil.diakui.toString()).toBe("0");
    expect(hasil.proyeksi.toString()).toBe("0");
  });
});
