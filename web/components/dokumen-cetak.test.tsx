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

type IsiCetak = React.ComponentProps<typeof DokumenCetak>["isi"];

function pasang(perusahaan: Partial<Perusahaan> = {}, isi: Partial<IsiCetak> = {}) {
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
        ...isi,
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

/* ==========================================================================
   WARNA HANYA PENEKANAN

   Dokumen ini dicetak di printer hitam putih sama seringnya dengan dilihat
   di layar. Di situ birunya menjadi abu dan hijaunya hampir putih.

   Jadi setiap hal yang membedakan satu baris dari baris lain harus TETAP ADA
   tanpa warna: judul kelompok dikenali dari kolom angkanya yang kosong,
   baris TOTAL dari hurufnya yang tebal dan kata "TOTAL" itu sendiri.

   Kalau suatu saat ada yang mengandalkan warna saja, yang menemukannya
   adalah orang yang menerima dokumennya — setelah dicetak.
   ========================================================================== */

const BARIS_BERHARGA = {
  id: "1",
  item_name: "INDONESIAN BUFFET",
  unit: "pax",
  day: "1",
  qty: "50",
  price: "160000",
  subtotal: "8000000",
  is_compliment: false,
  anak: [],
};

const JUDUL_KELOMPOK = {
  id: "2",
  item_name: "ANEKA STALL",
  unit: null,
  day: "1",
  qty: "1",
  price: "0",
  subtotal: "0",
  is_compliment: false,
  anak: [
    {
      id: "2a",
      item_name: "Bakwan Malang",
      unit: "Porsi",
      day: "1",
      qty: "35",
      price: "39500",
      subtotal: "1382500",
    },
  ],
};

describe("warna pada dokumen cetak", () => {
  it("judul kelompok tetap dikenali tanpa warna: kolom angkanya kosong", () => {
    pasang({}, { baris: [BARIS_BERHARGA, JUDUL_KELOMPOK] });

    // Kolomnya: No, Deskripsi, Hari, Qty, Satuan, Harga, Subtotal.
    const judul = barisTabel("ANEKA STALL");
    // Seluruh kolom angkanya kosong — ITU yang membedakannya dari baris
    // berharga, bukan latar abunya.
    expect(judul.slice(2)).toEqual(["", "", "", "", ""]);

    const berharga = barisTabel("INDONESIAN BUFFET");
    expect(berharga[2]).toBe("1"); // hari
    expect(berharga[3]).toBe("50"); // qty
    expect(berharga[6]).toBe("Rp 8.000.000");
  });

  it("baris TOTAL tetap dikenali tanpa warna: tebal dan bernama TOTAL", () => {
    pasang({}, { baris: [BARIS_BERHARGA], grand_total: "8000000" });

    const sel = screen.getByText("TOTAL");
    expect(sel.closest("tr")?.className).toContain("font-bold");
  });

  it("nama item tetap terbaca utuh, bukan hanya berwarna", () => {
    pasang({}, { baris: [BARIS_BERHARGA] });
    expect(screen.getByText("INDONESIAN BUFFET")).toBeTruthy();
  });
});

/** Isi satu baris tabel rincian, sebagai teks per kolom. */
function barisTabel(namaItem: string): string[] {
  const sel = screen.getByText(namaItem).closest("tr");
  return Array.from(sel?.querySelectorAll("td") ?? []).map((td) =>
    (td.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}
