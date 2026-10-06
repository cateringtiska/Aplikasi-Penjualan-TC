import { LABEL_PERAN, type Peran } from "./peran";

/**
 * Peta menu — satu-satunya sumber kebenaran untuk navigasi DAN hak akses.
 *
 * Hak akses di sini mencerminkan persis middleware `role:` di routes/web.php
 * milik Laravel. Admin selalu boleh masuk ke mana saja, jadi tidak perlu
 * ditulis berulang di setiap baris.
 */

export type ButirMenu = {
  /**
   * Kunci izin. Dipakai tabel role_permissions DAN penjaga di tiap halaman,
   * jadi menyembunyikan menu dan menolak membuka halamannya tidak bisa
   * menyimpang — keduanya membaca kunci yang sama.
   *
   * TIDAK BOLEH BERUBAH setelah dipakai: ia tersimpan di database.
   */
  kunci: KunciMenu;
  label: string;
  href: string;
  /**
   * Peran non-admin yang boleh membuka, SEBELUM pengaturan admin.
   *
   * Hanya dipakai sebagai semai awal tabel izin dan sebagai cadangan kalau
   * barisnya belum ada. Yang berlaku sehari-hari adalah isi tabelnya.
   */
  peran: Exclude<Peran, "admin">[];
  /**
   * Halaman yang izinnya TIDAK BOLEH diberikan ke peran lain.
   *
   * Halaman User bisa membuat admin baru, dan admin baru bisa membuka
   * seluruh halaman lain — memberikannya ke peran lain diam-diam membatalkan
   * setiap pembatasan yang lain. Kalau memang perlu, jadikan orangnya admin:
   * itu terlihat di daftar user, sedangkan jalan belakang tidak.
   */
  hanyaAdmin?: boolean;
};

/** Kunci izin. Tersimpan di database, jadi tidak boleh berubah. */
export type KunciMenu =
  | "dasbor"
  | "penawaran"
  | "tagihan"
  | "pembayaran"
  | "laporan-penjualan"
  | "laporan-piutang"
  | "laporan-margin"
  | "pelanggan"
  | "produk"
  | "pengguna"
  | "perusahaan";

export type KelompokMenu = {
  judul: string;
  butir: ButirMenu[];
};

export const MENU: KelompokMenu[] = [
  {
    judul: "Ringkasan",
    butir: [
      // Cost TIDAK termasuk: dasbor memperlihatkan piutang dan omzet
      // seluruh perusahaan, sedangkan pekerjaannya mengisi biaya.
      { kunci: "dasbor", label: "Dashboard", href: "/dasbor", peran: ["sales", "finance"] },
    ],
  },
  {
    judul: "Transaksi",
    butir: [
      { kunci: "penawaran", label: "Quotation", href: "/penawaran", peran: ["sales", "finance"] },
      { kunci: "tagihan", label: "Invoice", href: "/tagihan", peran: ["sales", "finance"] },
      { kunci: "pembayaran", label: "Payment", href: "/pembayaran", peran: ["finance"] },
    ],
  },
  {
    judul: "Laporan",
    butir: [
      {
        kunci: "laporan-penjualan",
        label: "Penjualan",
        href: "/laporan/penjualan",
        peran: ["sales", "finance"],
      },
      {
        kunci: "laporan-piutang",
        label: "Kartu Piutang",
        href: "/laporan/piutang",
        peran: ["sales", "finance"],
      },
      {
        kunci: "laporan-margin",
        label: "Margin",
        href: "/laporan/margin",
        peran: ["finance", "cost"],
      },
    ],
  },
  {
    judul: "Data Induk",
    butir: [
      { kunci: "pelanggan", label: "Customer", href: "/pelanggan", peran: ["sales", "finance"] },
      { kunci: "produk", label: "Product", href: "/produk", peran: ["sales", "finance"] },
    ],
  },
  {
    judul: "Pengaturan",
    butir: [
      { kunci: "pengguna", label: "User", href: "/pengguna", peran: [], hanyaAdmin: true },
      { kunci: "perusahaan", label: "Company", href: "/perusahaan", peran: [], hanyaAdmin: true },
    ],
  },
];

export function bolehAkses(peran: Peran, butir: ButirMenu): boolean {
  if (peran === "admin") return true;
  return butir.peran.includes(peran as Exclude<Peran, "admin">);
}

/** Menu yang sudah disaring sesuai peran — dipakai untuk menggambar sidebar. */
export function menuUntuk(peran: Peran): KelompokMenu[] {
  return MENU.map((kelompok) => ({
    ...kelompok,
    butir: kelompok.butir.filter((butir) => bolehAkses(peran, butir)),
  })).filter((kelompok) => kelompok.butir.length > 0);
}

// Diteruskan supaya layar yang sudah mengimpornya dari sini tidak berubah.
export { LABEL_PERAN };

/* ==========================================================================
   SIAPA BOLEH MEMBUKA APA

   Aturannya murni, tanpa menyentuh database — supaya bisa diuji sebagai
   satuan. Pembacaan tabelnya ada di lib/izin.ts.

   TIGA ATURAN YANG TIDAK BISA DIUBAH SIAPA PUN:

   1. ADMIN SELALU LOLOS. Tanpa ini, satu centang yang terlepas bisa
      mengunci pemiliknya keluar dari halaman yang justru dipakai untuk
      memperbaikinya — dan tidak ada jalan masuk lain.

   2. HALAMAN PENGATURAN MILIK ADMIN SAJA. Halaman User bisa membuat admin
      baru, dan admin baru bisa membuka seluruh halaman lain; memberikannya
      ke peran lain diam-diam membatalkan setiap pembatasan yang lain. Kalau
      memang perlu, jadikan orangnya admin — itu terlihat di daftar user,
      sedangkan jalan belakang tidak.

   3. BARIS YANG BELUM ADA MEMAKAI ATURAN BAWAAN, bukan ditolak. Menambah
      halaman baru lalu lupa menyemai izinnya akan menutup halaman itu untuk
      semua orang kecuali admin, tanpa sebab yang bisa dijelaskan.
   ========================================================================== */

/** Izin yang tersimpan, dikunci "peran:kunci". */
export type PetaIzin = Map<string, boolean>;

export const kunciIzin = (peran: string, kunci: string) => `${peran}:${kunci}`;

/** Butir menu menurut kuncinya. */
export function butirMenu(kunci: KunciMenu): ButirMenu | undefined {
  for (const kelompok of MENU) {
    const ketemu = kelompok.butir.find((b) => b.kunci === kunci);
    if (ketemu) return ketemu;
  }
  return undefined;
}

export function bolehBuka(peran: Peran, kunci: KunciMenu, izin: PetaIzin): boolean {
  if (peran === "admin") return true;

  const butir = butirMenu(kunci);
  if (butir?.hanyaAdmin) return false;

  const tersimpan = izin.get(kunciIzin(peran, kunci));
  if (tersimpan !== undefined) return tersimpan;

  return butir?.peran.includes(peran as Exclude<Peran, "admin">) ?? false;
}

/**
 * Halaman pertama yang dibuka seseorang setelah masuk.
 *
 * Dulu semua peran dilempar ke /dasbor. Bagian Cost hanya boleh membuka
 * laporan Margin, jadi ia mendarat di halaman yang menu-nya pun tidak ia
 * punya — memperlihatkan piutang dan omzet seluruh perusahaan, padahal
 * pekerjaannya mengisi biaya.
 *
 * Diambil dari MENU, bukan ditulis per peran: halaman pertama yang BOLEH
 * ia buka. Dengan begitu peran baru, dan perubahan centang oleh admin,
 * tidak perlu diingat di tempat kedua.
 *
 * Yang dikembalikan SELALU halaman yang boleh dibuka peran itu. Kalau tidak,
 * halaman tujuannya akan melempar balik ke sini dan berputar tanpa henti.
 * "/dasbor" dipakai sebagai hentian terakhir ketika tidak ada satu pun
 * halaman yang terbuka — dasbor hanya menuntut sesi, jadi putarannya
 * berhenti di situ.
 */
export function halamanAwal(peran: Peran, izin: PetaIzin): string {
  for (const kelompok of MENU) {
    for (const butir of kelompok.butir) {
      if (bolehBuka(peran, butir.kunci, izin)) return butir.href;
    }
  }
  return "/dasbor";
}

/** Menu yang sudah disaring sesuai izin yang berlaku. */
export function menuUntukIzin(peran: Peran, izin: PetaIzin): KelompokMenu[] {
  return MENU.map((kelompok) => ({
    ...kelompok,
    butir: kelompok.butir.filter((b) => bolehBuka(peran, b.kunci, izin)),
  })).filter((kelompok) => kelompok.butir.length > 0);
}

/** Peran yang izinnya boleh diatur. Admin tidak termasuk — ia selalu lolos. */
export const PERAN_DIATUR: Exclude<Peran, "admin">[] = ["sales", "finance", "cost"];
