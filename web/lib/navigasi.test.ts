import { describe, expect, it } from "vitest";

import { PERAN } from "./peran";

import {
  bolehBuka,
  butirMenu,
  kunciIzin,
  LABEL_PERAN,
  MENU,
  menuUntukIzin,
  PERAN_DIATUR,
  type PetaIzin,
} from "./navigasi";

/* ==========================================================================
   SIAPA BOLEH MEMBUKA APA

   Hak aksesnya kini diatur pemiliknya lewat halaman User. Yang dikunci di
   sini adalah tiga aturan yang TIDAK BOLEH bisa diubah oleh centang mana
   pun — karena ketiganya kalau terlepas tidak menimbulkan galat, hanya
   keadaan yang salah dan sulit disadari.
   ========================================================================== */

const izin = (isi: Record<string, boolean> = {}): PetaIzin =>
  new Map(Object.entries(isi).map(([k, v]) => [k, v]));

describe("admin selalu lolos", () => {
  it("membuka SELURUH halaman, apa pun isi tabel izinnya", () => {
    // Seluruh izin dimatikan — admin tetap lolos. Tanpa ini, satu centang
    // yang terlepas bisa mengunci pemiliknya keluar dari halaman User, yang
    // justru satu-satunya tempat untuk memperbaikinya.
    const semuaMati: Record<string, boolean> = {};
    for (const kelompok of MENU) {
      for (const b of kelompok.butir) {
        for (const p of PERAN_DIATUR) semuaMati[kunciIzin(p, b.kunci)] = false;
        semuaMati[kunciIzin("admin", b.kunci)] = false;
      }
    }

    for (const kelompok of MENU) {
      for (const b of kelompok.butir) {
        expect(bolehBuka("admin", b.kunci, izin(semuaMati)), b.label).toBe(true);
      }
    }

    expect(menuUntukIzin("admin", izin(semuaMati)).length).toBe(MENU.length);
  });
});

describe("halaman pengaturan milik admin saja", () => {
  it("TIDAK BISA diberikan ke peran lain, walaupun izinnya dicentang", () => {
    // Halaman User bisa membuat admin baru, dan admin baru bisa membuka
    // seluruh halaman lain — memberikannya ke peran lain diam-diam
    // membatalkan setiap pembatasan yang lain.
    //
    // Diulang untuk SETIAP peran yang diatur, bukan untuk dua peran yang
    // ditulis namanya: peran yang ditambahkan belakangan akan ikut diperiksa
    // tanpa ada yang perlu ingat memperbarui tes ini.
    const halamanAdmin = MENU.flatMap((k) => k.butir)
      .filter((b) => b.hanyaAdmin)
      .map((b) => b.kunci);

    expect(halamanAdmin.length, "tidak ada halaman khusus admin lagi?").toBeGreaterThan(0);

    const dipaksa = izin(
      Object.fromEntries(
        PERAN_DIATUR.flatMap((p) => halamanAdmin.map((k) => [kunciIzin(p, k), true])),
      ),
    );

    for (const p of PERAN_DIATUR) {
      for (const k of halamanAdmin) {
        expect(bolehBuka(p, k, dipaksa), `${p} → ${k}`).toBe(false);
      }
    }
  });

  it("menandai halaman itu, supaya layarnya bisa menjelaskan kenapa", () => {
    expect(butirMenu("pengguna")?.hanyaAdmin).toBe(true);
    expect(butirMenu("perusahaan")?.hanyaAdmin).toBe(true);
    expect(butirMenu("tagihan")?.hanyaAdmin).toBeUndefined();
  });
});

describe("baris yang belum ada", () => {
  it("memakai aturan bawaannya, BUKAN ditolak", () => {
    // Menambah halaman baru lalu lupa menyemai izinnya akan menutup halaman
    // itu untuk semua orang kecuali admin, tanpa sebab yang bisa dijelaskan.
    const kosong = izin();

    expect(bolehBuka("sales", "tagihan", kosong)).toBe(true);
    expect(bolehBuka("finance", "pembayaran", kosong)).toBe(true);
    expect(bolehBuka("sales", "pembayaran", kosong)).toBe(false);
    expect(bolehBuka("sales", "laporan-margin", kosong)).toBe(false);
  });

  it("yang TERSIMPAN menang atas bawaannya, ke dua arah", () => {
    // Inti dari "diatur sendiri": pemiliknya bisa memberi DAN mencabut.
    expect(bolehBuka("sales", "laporan-margin", izin({ "sales:laporan-margin": true }))).toBe(
      true,
    );
    expect(bolehBuka("sales", "tagihan", izin({ "sales:tagihan": false }))).toBe(false);
  });
});

describe("menu mengikuti izin yang sama", () => {
  it("menyembunyikan kelompok yang seluruh isinya tertutup", () => {
    const hanyaDasbor: Record<string, boolean> = {};
    for (const kelompok of MENU) {
      for (const b of kelompok.butir) {
        hanyaDasbor[kunciIzin("sales", b.kunci)] = b.kunci === "dasbor";
      }
    }

    const menu = menuUntukIzin("sales", izin(hanyaDasbor));
    expect(menu).toHaveLength(1);
    expect(menu[0].butir.map((b) => b.kunci)).toEqual(["dasbor"]);
  });

  it("menampilkan persis yang boleh dibuka, tidak lebih", () => {
    // Menu yang menampilkan halaman yang ternyata ditolak adalah cara paling
    // membingungkan untuk memberitahu orang bahwa ia tidak punya akses.
    const peta = izin({ "sales:laporan-margin": true, "sales:tagihan": false });
    const menu = menuUntukIzin("sales", peta);

    for (const kelompok of menu) {
      for (const b of kelompok.butir) {
        expect(bolehBuka("sales", b.kunci, peta), b.label).toBe(true);
      }
    }

    const terlihat = menu.flatMap((k) => k.butir.map((b) => b.kunci));
    expect(terlihat).toContain("laporan-margin");
    expect(terlihat).not.toContain("tagihan");
    expect(terlihat).not.toContain("pengguna");
  });
});

describe("kunci izin", () => {
  it("unik untuk setiap butir menu", () => {
    // Dua butir berkunci sama akan membuat satu centang mengubah dua
    // halaman sekaligus.
    const kunci = MENU.flatMap((k) => k.butir.map((b) => b.kunci));
    expect(new Set(kunci).size).toBe(kunci.length);
  });
});

describe("peran Cost", () => {
  it("membuka dokumen, product, dan margin — bukan uang maupun laporan penjualan", () => {
    // Pekerjaannya mengisi biaya, jadi ia perlu melihat dokumennya dan
    // halaman margin. Bawaannya TIDAK memberinya payment, laporan penjualan,
    // kartu piutang, maupun data customer.
    //
    // Yang ditulis di sini adalah BAWAANNYA, yang berlaku ketika barisnya di
    // tabel izin belum ada. Admin tetap bisa mengubahnya kapan saja dari
    // layar User.
    const kosong = izin();

    expect(bolehBuka("cost", "dasbor", kosong)).toBe(true);
    expect(bolehBuka("cost", "penawaran", kosong)).toBe(true);
    expect(bolehBuka("cost", "tagihan", kosong)).toBe(true);
    expect(bolehBuka("cost", "produk", kosong)).toBe(true);
    expect(bolehBuka("cost", "laporan-margin", kosong)).toBe(true);

    expect(bolehBuka("cost", "pembayaran", kosong)).toBe(false);
    expect(bolehBuka("cost", "laporan-penjualan", kosong)).toBe(false);
    expect(bolehBuka("cost", "laporan-piutang", kosong)).toBe(false);
    expect(bolehBuka("cost", "pelanggan", kosong)).toBe(false);
  });

  it("ikut muncul di tabel hak akses, supaya admin bisa mengaturnya", () => {
    // Peran yang ada di kode tetapi tidak di PERAN_DIATUR tidak punya kolom
    // di layar User: hak aksesnya tidak bisa diubah siapa pun, dan tidak ada
    // tanda apa pun bahwa kolomnya hilang.
    expect(PERAN_DIATUR).toContain("cost");
  });
});

describe("setiap peran punya nama di layar", () => {
  it("tidak ada yang tampil sebagai kode mentah", () => {
    // LABEL_PERAN bertipe Record<Peran, string>, jadi yang terlewat akan
    // gagal dikompilasi. Tes ini menjaga sisanya: label kosong lolos tipe,
    // lalu muncul di layar sebagai ruang hampa.
    for (const p of PERAN) {
      expect(LABEL_PERAN[p]?.trim(), `label peran ${p}`).toBeTruthy();
    }
  });

  it("memuat seluruh peran yang diatur, plus admin", () => {
    expect(new Set(PERAN)).toEqual(new Set(["admin", ...PERAN_DIATUR]));
  });
});
