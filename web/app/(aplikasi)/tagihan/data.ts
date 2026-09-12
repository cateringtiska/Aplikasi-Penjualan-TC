import type { IstilahDokumen } from "@/components/form-dokumen";

export { hariIni, pilihanForm, tanggalUntukInput } from "@/lib/pilihan";

export const ISTILAH_TAGIHAN: IstilahDokumen = {
  kata: "invoice",
  labelTanggal: "Tanggal invoice",
  labelTanggalAkhir: "Jatuh tempo",
  tombolSimpan: "Simpan invoice",
  batalHref: "/tagihan",
};
