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

/* ==========================================================================
   BIAYA TAMBAHAN BERNAMA

   Baris di luar service charge dan PB1, sama kedudukannya dengan delivery
   tetapi namanya bebas dan jumlahnya boleh lebih dari satu. Dokumen katering
   sungguhan memuat "Tim Servis utk Menu Buffet (1 orang)" dan "Tambahan
   Set-up & Layanan 1 Titik VIP Buffet" — bentuk yang tidak mungkin ditebak
   sebelumnya, jadi tidak bisa dijadikan kolom tetap.
   ========================================================================== */

function coba(tambahan: Record<string, unknown>) {
  return siapkanDokumen({ ...DASAR, ...tambahan }, { labelTanggalAkhir: "Jatuh tempo" });
}

describe("biaya tambahan", () => {
  it("masuk ke grand total tanpa mengubah subtotal", () => {
    const hasil = coba({
      biaya_tambahan: [
        { label: "Tim Servis utk Menu Buffet (1 orang)", amount: "350.000" },
        { label: "Tambahan Set-up & Layanan 1 Titik VIP Buffet", amount: "1.350.000" },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));

    // 35 x 78.500 = 2.747.500 — subtotalnya tidak boleh bergeser.
    expect(hasil.kolom.subtotal).toBe("2747500.00");
    expect(hasil.kolom.grand_total).toBe("4447500.00");
    expect(hasil.tambahan.map((b) => b.label)).toEqual([
      "Tim Servis utk Menu Buffet (1 orang)",
      "Tambahan Set-up & Layanan 1 Titik VIP Buffet",
    ]);
  });

  it("MEMBUANG baris yang kosong sama sekali", () => {
    // Orang menambah baris lalu berubah pikiran. Memaksanya menghapus baris
    // kosong sebelum boleh menyimpan hanya menghalangi.
    const hasil = coba({
      biaya_tambahan: [
        { label: "", amount: "" },
        { label: "Set-up panggung", amount: "500.000" },
        { label: "   ", amount: "  " },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.tambahan).toHaveLength(1);
    expect(hasil.kolom.grand_total).toBe("3247500.00");
  });

  it("MENOLAK jumlah yang tidak bernama", () => {
    // Angka tanpa keterangan di dokumen yang dikirim ke customer akan
    // ditanyakan balik, dan saat itu tidak ada yang masih ingat untuk apa.
    const hasil = coba({ biaya_tambahan: [{ label: "", amount: "750.000" }] });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.biaya_tambahan).toMatch(/namanya belum diisi/i);
  });

  it("MENOLAK jumlah minus", () => {
    const hasil = coba({ biaya_tambahan: [{ label: "Potongan", amount: "-500.000" }] });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.biaya_tambahan).toMatch(/tidak boleh minus/i);
  });

  it("menerima baris bernama yang jumlahnya belum diisi", () => {
    // Namanya sudah diketik, angkanya menyusul. Membuangnya diam-diam akan
    // menghapus ketikan orang tanpa memberitahu.
    const hasil = coba({ biaya_tambahan: [{ label: "Menyusul", amount: "" }] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.tambahan).toHaveLength(1);
    expect(hasil.tambahan[0].amount.toString()).toBe("0");
  });
});
