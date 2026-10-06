import { describe, expect, it } from "vitest";

import {
  bolehBuka,
  butirMenu,
  kunciIzin,
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
    const dipaksa = izin({
      [kunciIzin("finance", "pengguna")]: true,
      [kunciIzin("sales", "pengguna")]: true,
      [kunciIzin("finance", "perusahaan")]: true,
    });

    expect(bolehBuka("finance", "pengguna", dipaksa)).toBe(false);
    expect(bolehBuka("sales", "pengguna", dipaksa)).toBe(false);
    expect(bolehBuka("finance", "perusahaan", dipaksa)).toBe(false);
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
