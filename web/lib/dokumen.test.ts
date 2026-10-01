import { describe, expect, it } from "vitest";

import { siapkanDokumen } from "./dokumen";

/* ==========================================================================
   TANDA HUBUNG YANG DIKETIK BERARTI KOSONG

   Orang mengetik "-" untuk menyatakan "tidak ada" — kebiasaan dari mengisi
   formulir kertas. Aplikasi memperlakukannya sebagai isi yang sah, dan
   hasilnya terbaca di dokumen yang dikirim ke klien: judul "INVOICE - -",
   karena jenis acaranya memang berisi satu tanda hubung.

   Ditemukan pemiliknya pada invoice sungguhan yang pertama.

   Yang dikosongkan HANYA nilai yang seluruhnya tanda hubung. Alamat seperti
   "The Telkom Hub - Jl. Gatot Subroto" harus tetap utuh — kalau aturannya
   terlalu rakus, justru alamat venue yang hilang dari dokumen.
   ========================================================================== */

const DASAR = {
  customer_id: "1",
  tanggal: "2026-06-30",
  tanggal_akhir: "2026-09-30",
  items: [{ item_name: "Nasi box", qty: "35", price: "78500" }],
};

function siapkan(tambahan: Record<string, unknown>) {
  const hasil = siapkanDokumen({ ...DASAR, ...tambahan }, { labelTanggalAkhir: "Jatuh tempo" });
  if (!hasil.ok) throw new Error("tidak lolos validasi: " + JSON.stringify(hasil.keadaan));
  return hasil.kolom;
}

describe("isian yang hanya berisi tanda hubung", () => {
  it("dikosongkan, bukan disimpan apa adanya", () => {
    const kolom = siapkan({
      event_type: "-",
      event_time: "  -  ",
      venue: "--",
      fnb_planner: "–",
      contact_person: "-",
      contact_phone: "-",
      notes: "-",
    });

    expect(kolom.event_type).toBeNull();
    expect(kolom.event_time).toBeNull();
    expect(kolom.venue).toBeNull();
    expect(kolom.fnb_planner).toBeNull();
    expect(kolom.contact_person).toBeNull();
    expect(kolom.contact_phone).toBeNull();
    expect(kolom.notes).toBeNull();
  });

  it("TIDAK mengosongkan isian yang kebetulan memuat tanda hubung", () => {
    const kolom = siapkan({
      venue: "The Telkom Hub - Jl. Gatot Subroto No.Kav.52",
      event_type: "Coffee Break - Pagi",
      contact_phone: "0813-1163-7295",
    });

    expect(kolom.venue).toBe("The Telkom Hub - Jl. Gatot Subroto No.Kav.52");
    expect(kolom.event_type).toBe("Coffee Break - Pagi");
    expect(kolom.contact_phone).toBe("0813-1163-7295");
  });

  it("merapikan spasi di tepi isian biasa", () => {
    expect(siapkan({ event_type: "  Gathering  " }).event_type).toBe("Gathering");
  });
});
