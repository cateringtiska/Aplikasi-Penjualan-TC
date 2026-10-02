import type { Peran } from "./auth";

/**
 * Peta menu — satu-satunya sumber kebenaran untuk navigasi DAN hak akses.
 *
 * Hak akses di sini mencerminkan persis middleware `role:` di routes/web.php
 * milik Laravel. Admin selalu boleh masuk ke mana saja, jadi tidak perlu
 * ditulis berulang di setiap baris.
 */

export type ButirMenu = {
  label: string;
  href: string;
  /** Peran non-admin yang boleh membuka. Admin selalu boleh. */
  peran: Exclude<Peran, "admin">[];
};

export type KelompokMenu = {
  judul: string;
  butir: ButirMenu[];
};

export const MENU: KelompokMenu[] = [
  {
    judul: "Ringkasan",
    butir: [{ label: "Dashboard", href: "/dasbor", peran: ["sales", "finance"] }],
  },
  {
    judul: "Transaksi",
    butir: [
      { label: "Quotation", href: "/penawaran", peran: ["sales", "finance"] },
      { label: "Invoice", href: "/tagihan", peran: ["sales", "finance"] },
      { label: "Payment", href: "/pembayaran", peran: ["finance"] },
    ],
  },
  {
    judul: "Laporan",
    butir: [
      { label: "Penjualan", href: "/laporan/penjualan", peran: ["sales", "finance"] },
      { label: "Kartu Piutang", href: "/laporan/piutang", peran: ["sales", "finance"] },
      { label: "Margin", href: "/laporan/margin", peran: ["finance"] },
    ],
  },
  {
    judul: "Data Induk",
    butir: [
      { label: "Customer", href: "/pelanggan", peran: ["sales", "finance"] },
      { label: "Product", href: "/produk", peran: ["sales", "finance"] },
    ],
  },
  {
    judul: "Pengaturan",
    butir: [
      { label: "User", href: "/pengguna", peran: [] },
      { label: "Company", href: "/perusahaan", peran: [] },
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

export const LABEL_PERAN: Record<Peran, string> = {
  admin: "Admin",
  sales: "Sales",
  finance: "Finance",
};
