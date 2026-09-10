import type { IstilahDokumen } from "@/components/form-dokumen";

export { hariIni, pilihanForm, tanggalUntukInput } from "@/lib/pilihan";

export const ISTILAH_TAGIHAN: IstilahDokumen = {
  kata: "tagihan",
  labelTanggal: "Tanggal tagihan",
  labelTanggalAkhir: "Jatuh tempo",
  tombolSimpan: "Simpan tagihan",
  batalHref: "/tagihan",
};
