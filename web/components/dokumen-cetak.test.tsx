import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DokumenCetak, type Perusahaan } from "./dokumen-cetak";

/* ==========================================================================
   KETERANGAN PEMBAYARAN DI DOKUMEN CETAK

   Ini satu-satunya bagian dokumen yang harus DISALIN DENGAN TEPAT oleh
   penerimanya. Nomor rekening yang salah satu angka membuat uangnya tidak
   sampai, dan yang menanggung akibatnya adalah orang yang mengirim.

   Yang dikunci di sini adalah apa yang benar-benar terbaca di kertas:
   seluruh keterangan harus utuh walaupun dicetak hitam putih, dan baris
   yang datanya belum diisi tidak boleh meninggalkan label menggantung
   seperti "Bank Code:" tanpa kodenya.
   ========================================================================== */

const PERUSAHAAN: Perusahaan = {
  company_name: "PT. Tiska Cipta Imaji",
  logo_path: null,
  signature_url: null,
  signature_name: "Rita Ariyani",
  bank_name: "BCA [Bank Central Asia] - KCP Monginsidi",
  bank_account_number: "210 - 999 - 8880",
  bank_account_holder: "PT. TISKA CIPTA IMAJI",
  bank_code: "014 - 0397 (KPO)",
  swift_code: "CENAIDJA",
};

function pasang(perusahaan: Partial<Perusahaan> = {}) {
  render(
    <DokumenCetak
      isi={{
        judul: "Invoice",
        labelNomor: "No. Invoice",
        nomor: "INV-2026-0001",
        tanggal: new Date("2026-05-01"),
        labelTanggalKedua: "Jatuh Tempo",
        tanggalKedua: new Date("2026-05-15"),
        pelanggan: { nama: "MEY Bakery", alamat: null },
        kontak: { nama: null, telepon: null },
        acara: {
          tanggal: [],
          tamu: null,
          planner: null,
          jam: null,
          venue: null,
          jenis: null,
        },
        baris: [],
        subtotal: "0",
        service_charge_percent: null,
        service_charge_amount: "0",
        pb1_enabled: false,
        pb1_percent: null,
        pb1_amount: "0",
        delivery_amount: "0",
        biaya_tambahan: [],
        grand_total: "0",
        catatan: null,
        syarat: null,
        perusahaan: { ...PERUSAHAAN, ...perusahaan },
      }}
    />,
  );
}

/** Teks satu baris, spasi dirapikan — seperti yang dibaca orang di kertas. */
function baris(awalan: string): string {
  const el = screen
    .getAllByText((_, node) => {
      const teks = node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      return teks.startsWith(awalan) && (node?.children.length ?? 0) <= 3;
    })
    .at(-1);

  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

describe("keterangan pembayaran", () => {
  it("terbaca utuh tanpa bergantung pada warnanya", () => {
    // Dicetak hitam putih, merahnya menjadi abu-abu. Kalimatnya harus tetap
    // lengkap — bukan "Account number:" dengan angka yang hanya berwarna.
    pasang();

    expect(baris("Pembayaran via transfer")).toBe(
      "Pembayaran via transfer ke Rekening BARU: BCA [Bank Central Asia] - KCP Monginsidi",
    );
    expect(baris("Account number")).toBe(
      "Account number: 210 - 999 - 8880 atas nama pemilik rekening: PT. TISKA CIPTA IMAJI",
    );
    expect(baris("Bank Code")).toBe("Bank Code: 014 - 0397 (KPO); Swift Code: CENAIDJA");
  });

  it("menulis nomor rekening PERSIS seperti yang disimpan", () => {
    // Tidak dirapikan, tidak dibuang spasinya, tidak diubah pengelompokannya.
    pasang({ bank_account_number: "1 2 3 4-5678" });
    expect(baris("Account number")).toContain("1 2 3 4-5678");
  });

  it("tidak meninggalkan label menggantung ketika kodenya belum diisi", () => {
    pasang({ bank_code: null, swift_code: null });

    expect(screen.queryByText(/Bank Code/)).toBeNull();
    expect(screen.queryByText(/Swift Code/)).toBeNull();
    // Dua baris lainnya tetap tercetak.
    expect(baris("Account number")).toContain("210 - 999 - 8880");
  });

  it("mencetak salah satu kode saja tanpa titik koma menggantung", () => {
    pasang({ swift_code: null });
    expect(baris("Bank Code")).toBe("Bank Code: 014 - 0397 (KPO)");
  });

  it("menghilangkan seluruh kotaknya ketika banknya belum diisi", () => {
    pasang({ bank_name: null });
    expect(screen.queryByText(/Pembayaran via transfer/)).toBeNull();
  });
});
