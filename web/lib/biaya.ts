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
  { nilai: "lain_lain", label: "Lain-lain" },
] as const;

export type KategoriBiaya = (typeof KATEGORI_BIAYA)[number]["nilai"];

export const NILAI_KATEGORI = KATEGORI_BIAYA.map((k) => k.nilai);

export function labelKategori(nilai: string): string {
  return KATEGORI_BIAYA.find((k) => k.nilai === nilai)?.label ?? nilai;
}
