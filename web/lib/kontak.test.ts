import { describe, expect, it } from "vitest";

import { namaPic } from "./kontak";

/* ==========================================================================
   SIAPA YANG DITAMPILKAN SEBAGAI PIC

   Ada dua tempat nama orang tersimpan, dan keduanya sering terisi sekaligus:

     contact_person pada dokumennya   "UP - Kepada" pada invoice ini
     pic_name pada customernya        orang tetap di perusahaan itu

   YANG MENANG ADALAH KONTAK PADA DOKUMENNYA. Satu customer besar bisa punya
   beberapa orang yang memesan — Human Capital, Marketing, Sekretariat — dan
   yang ditelepon saat menagih invoice ini adalah orang yang namanya tertulis
   di invoice ini, bukan nama tetap di data customer.

   Terbalik, daftar tagihan akan menyebut satu nama yang sama untuk seluruh
   invoice sebuah perusahaan, dan nama itu belum tentu tahu apa-apa tentang
   pesanannya.
   ========================================================================== */

describe("namaPic", () => {
  it("MENGUTAMAKAN kontak pada dokumennya", () => {
    expect(namaPic("Bapak Andy", "Ibu Santi")).toBe("Bapak Andy");
  });

  it("memakai PIC customer kalau dokumennya tidak menyebut siapa pun", () => {
    expect(namaPic(null, "Ibu Santi")).toBe("Ibu Santi");
    expect(namaPic("", "Ibu Santi")).toBe("Ibu Santi");
    expect(namaPic("   ", "Ibu Santi")).toBe("Ibu Santi");
  });

  it("mengembalikan null kalau keduanya kosong", () => {
    // Supaya pemanggilnya bisa menyembunyikan barisnya, bukan mencetak
    // tanda hubung yang tidak menjelaskan apa pun.
    expect(namaPic(null, null)).toBeNull();
    expect(namaPic("", "")).toBeNull();
    expect(namaPic(undefined, undefined)).toBeNull();
    expect(namaPic("  ", "  ")).toBeNull();
  });

  it("merapikan spasi di ujungnya", () => {
    expect(namaPic("  Bapak Andy  ", null)).toBe("Bapak Andy");
    expect(namaPic(null, "  Ibu Santi ")).toBe("Ibu Santi");
  });
});
