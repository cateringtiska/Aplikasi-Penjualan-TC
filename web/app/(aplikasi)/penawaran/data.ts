import type { IstilahDokumen } from "@/components/form-dokumen";

export { hariIni, pilihanForm, tanggalUntukInput } from "@/lib/pilihan";

export const ISTILAH_PENAWARAN: IstilahDokumen = {
  kata: "penawaran",
  labelTanggal: "Tanggal penawaran",
  labelTanggalAkhir: "Berlaku sampai",
  tombolSimpan: "Simpan penawaran",
  batalHref: "/penawaran",
};
