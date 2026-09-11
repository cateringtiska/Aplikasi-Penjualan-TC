import type { IstilahDokumen } from "@/components/form-dokumen";

export { hariIni, pilihanForm, tanggalUntukInput } from "@/lib/pilihan";

export const ISTILAH_PENAWARAN: IstilahDokumen = {
  kata: "quotation",
  labelTanggal: "Tanggal quotation",
  labelTanggalAkhir: "Berlaku sampai",
  tombolSimpan: "Simpan quotation",
  batalHref: "/penawaran",
};
