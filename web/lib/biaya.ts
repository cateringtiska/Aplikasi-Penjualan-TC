import { nilaiBiaya } from "./uang";

/** Kategori biaya acara, sesuai daftar yang dipakai aplikasi Laravel. */
export const KATEGORI_BIAYA = [
  { nilai: "hpp_bahan_baku", label: "HPP Bahan Baku" },
  { nilai: "hpp_barang", label: "HPP Barang" },
  { nilai: "tenaga_kerja", label: "Tenaga Kerja" },
  { nilai: "transportasi", label: "Transportasi" },
  { nilai: "delivery", label: "Delivery" },
  { nilai: "vendor", label: "Vendor" },
  { nilai: "sewa_peralatan", label: "Sewa Peralatan" },
  { nilai: "akomodasi", label: "Akomodasi" },
  { nilai: "entertainment", label: "Entertainment" },
  // Dipakai ketika PB1 yang dipungut dari customer benar-benar disetorkan.
  // Tanpa baris ini, PB1 terbaca sebagai bagian dari margin.
  { nilai: "pb1", label: "PB1 disetor" },
  { nilai: "lain_lain", label: "Lain-lain" },
] as const;

export type KategoriBiaya = (typeof KATEGORI_BIAYA)[number]["nilai"];

export const NILAI_KATEGORI = KATEGORI_BIAYA.map((k) => k.nilai);

export function labelKategori(nilai: string): string {
  return KATEGORI_BIAYA.find((k) => k.nilai === nilai)?.label ?? nilai;
}

/* ==========================================================================
   BENTUK DATA YANG DIPAKAI BERSAMA

   Biaya dicatat di dua tempat dengan tabel yang berbeda: quotation_costs
   untuk penawaran, invoice_costs untuk tagihan. Bentuk barisnya sengaja
   dibuat sama persis, supaya satu panel dan satu tampilan bisa melayani
   keduanya — dan supaya biaya penawaran bisa disalin apa adanya ketika
   penawaran berubah menjadi tagihan.
   ========================================================================== */

/** Satu baris biaya, siap ditampilkan. */
export type BarisBiaya = {
  id: string;
  category: string;
  description: string;
  estimated_amount: string | null;
  actual_amount: string | null;
  status: string;
  notes: string | null;
  /** Aktual bila sudah di atas nol, selebihnya estimasi. */
  nilaiDipakai: string;
};

/** Keadaan yang dikembalikan tindakan simpan biaya ke formulirnya. */
export type KeadaanBiaya = {
  sukses?: boolean;
  pesan?: string;
  galat?: Record<string, string>;
  /**
   * Penanda unik untuk setiap penyimpanan yang berhasil.
   *
   * Dipakai formulir sebagai `key` React, sehingga seluruh isian kembali
   * kosong dengan sendirinya — tanpa perlu membersihkannya satu per satu
   * lewat effect.
   */
  tanda?: string;
};

/**
 * Penguncian margin. Hanya tagihan yang punya ini.
 *
 * Margin penawaran adalah PERKIRAAN, dan perkiraan tidak difinalisasi —
 * angkanya masih boleh berubah sampai acaranya benar-benar terjadi. Yang
 * dikunci hanyalah angka nyata di tagihan.
 */
export type Penguncian = {
  terkunci: boolean;
  kunci: (idDokumen: string) => Promise<void>;
  buka: (idDokumen: string) => Promise<void>;
};

/**
 * Mengubah satu baris dari database menjadi bentuk yang ditampilkan panel.
 *
 * Kolom "Dipakai" sengaja dihitung lewat `nilaiBiaya` yang sama dengan yang
 * dipakai menghitung margin. Sebelumnya aturannya ditulis ulang di halaman,
 * dan aturan yang tersalin adalah aturan yang cepat atau lambat menyimpang —
 * angka di layar lalu berbeda dari angka yang benar-benar dihitung.
 */
export function keBarisTampil(b: {
  id: bigint | number | string;
  category: string;
  description: string;
  estimated_amount: { toString(): string } | null;
  actual_amount: { toString(): string } | null;
  status: string;
  notes: string | null;
}): BarisBiaya {
  const estimated_amount = b.estimated_amount?.toString() ?? null;
  const actual_amount = b.actual_amount?.toString() ?? null;

  return {
    id: b.id.toString(),
    category: b.category,
    description: b.description,
    estimated_amount,
    actual_amount,
    status: b.status,
    notes: b.notes,
    nilaiDipakai: nilaiBiaya({
      estimated_amount: estimated_amount ?? 0,
      actual_amount: actual_amount ?? 0,
    }).toFixed(2),
  };
}
