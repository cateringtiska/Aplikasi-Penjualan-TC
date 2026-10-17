import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/* ==========================================================================
   MENGGANTI CUSTOMER HARUS IKUT MENGGANTI KONTAKNYA

   Bug yang ditemukan pemiliknya saat memasukkan invoice sungguhan: ia memilih
   customer, kontaknya terisi, lalu mengganti ke customer lain — dan nama
   kontak serta teleponnya TETAP milik customer pertama.

   Sebabnya satu baris: `lama.contact_person || p?.contact_person`. Begitu
   kolomnya terisi, ia tidak pernah diganti lagi. Niat aslinya menjaga ketikan
   sendiri agar tidak tertimpa, tetapi akibatnya kontak customer pertama
   menempel pada semua customer berikutnya — dan itu tercetak di dokumen yang
   dikirim ke klien.

   Dua hal dikunci di sini, dan keduanya harus benar sekaligus:

   1. Ganti customer -> kontaknya ikut berganti.
   2. Kontak yang DIKETIK SENDIRI tidak boleh hilang. Sebuah acara bisa
      ditangani orang lain, bukan PIC yang tercatat di data customer.
   ========================================================================== */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FormDokumen } from "./form-dokumen";

const PELANGGAN = [
  { id: "1", nama: "House of Sekar", kode: "CUST-0001", contact_person: "Ibu Yuniar", phone: "0811-111" },
  { id: "2", nama: "MEY Bakery", kode: "CUST-0002", contact_person: "Ibu Amey", phone: "0822-222" },
  { id: "3", nama: "Tanpa PIC", kode: "CUST-0003", contact_person: null, phone: null },
];

const ISTILAH = {
  kata: "invoice",
  labelTanggal: "Tanggal invoice",
  labelTanggalAkhir: "Jatuh tempo",
  tombolSimpan: "Simpan invoice",
  batalHref: "/tagihan",
};

const ISI_AWAL = {
  customer_id: "",
  contact_person: "",
  contact_phone: "",
  tanggal: "2026-10-01",
  tanggal_akhir: "2026-10-15",
  event_dates: [],
  event_type: "",
  event_time: "",
  guest_count: "",
  fnb_planner: "",
  venue: "",
  notes: "",
  service_charge_percent: "",
  delivery_amount: "",
  biaya_tambahan: [],
  pb1_enabled: false,
  pb1_percent: "10",
  signatory_id: "",
  po_reference: "",
  show_payment_terms: false,
  payment_terms: "",
  items: [],
};

function pasang() {
  render(
    <FormDokumen
      isiAwal={ISI_AWAL}
      aksi={async () => ({})}
      istilah={ISTILAH}
      pelanggan={PELANGGAN}
      produk={[]}
      penandatangan={[]}
    />,
  );

  return {
    pilihan: screen.getByLabelText(/^customer/i) as HTMLSelectElement,
    kontak: screen.getByLabelText(/nama kontak/i) as HTMLInputElement,
    telepon: screen.getByLabelText(/telepon/i) as HTMLInputElement,
  };
}

describe("FormDokumen — memilih customer", () => {
  it("mengisi kontak dari customer yang dipilih", async () => {
    const { pilihan, kontak, telepon } = pasang();

    await userEvent.selectOptions(pilihan, "1");

    expect(kontak.value).toBe("Ibu Yuniar");
    expect(telepon.value).toBe("0811-111");
  });

  it("MENGGANTI kontak ketika customernya diganti", async () => {
    const { pilihan, kontak, telepon } = pasang();

    await userEvent.selectOptions(pilihan, "1");
    await userEvent.selectOptions(pilihan, "2");

    // Inti bug-nya: dulu keduanya tetap milik House of Sekar.
    expect(kontak.value).toBe("Ibu Amey");
    expect(telepon.value).toBe("0822-222");
  });

  it("mengosongkan kontak kalau customer barunya tidak punya PIC", async () => {
    const { pilihan, kontak, telepon } = pasang();

    await userEvent.selectOptions(pilihan, "1");
    await userEvent.selectOptions(pilihan, "3");

    // Membiarkan "Ibu Yuniar" di sini lebih berbahaya daripada kosong: nama
    // itu akan tercetak di dokumen untuk customer yang sama sekali lain.
    expect(kontak.value).toBe("");
    expect(telepon.value).toBe("");
  });

  it("tidak menghapus kontak yang diketik sendiri", async () => {
    const { pilihan, kontak } = pasang();

    await userEvent.selectOptions(pilihan, "1");
    await userEvent.clear(kontak);
    await userEvent.type(kontak, "Pak Dedi dari WO");

    await userEvent.selectOptions(pilihan, "2");

    // Sebuah acara bisa ditangani orang lain, bukan PIC yang tercatat.
    expect(kontak.value).toBe("Pak Dedi dari WO");
  });
});

describe("FormDokumen — isian pax", () => {
  /*
   * Kolom pax PERNAH HILANG dari formulir ini tanpa satu pun galat.
   *
   * Kolomnya sudah ada di database, jalur simpannya sudah menerimanya, dan
   * halaman ubah sudah mengirimkannya — tetapi isiannya tidak pernah
   * terpasang di layar. Tipe BarisForm waktu itu belum menuntut pax, jadi
   * nilai yang dikirim halaman ubah dibuang diam-diam, tsc tidak berkata
   * apa-apa, dan seluruh tes tetap hijau. Yang akan menemukannya adalah
   * orang yang membuka formulirnya dan tidak menemukan kolom yang
   * dijanjikan.
   *
   * Tes ini memeriksa isiannya benar-benar ADA di layar, sebab tipe saja
   * tidak cukup: tipe hanya menuntut datanya mengalir, bukan ada tempat
   * untuk mengetiknya.
   */
  function pasangDenganSatuBaris() {
    render(
      <FormDokumen
        isiAwal={{
          ...ISI_AWAL,
          items: [
            {
              kunci: "b1",
              product_id: "",
              day: "3",
              item_name: "LUNCH BOX",
              unit: "Box",
              qty: "130",
              pax: "",
              price: "50000",
              is_compliment: false,
              charge_service: true,
              charge_pb1: true,
              children: [],
            },
          ],
        }}
        aksi={async () => ({})}
        istilah={ISTILAH}
        pelanggan={PELANGGAN}
        produk={[]}
        penandatangan={[]}
      />,
    );
  }

  it("menyediakan tempat mengetik pax pada tiap baris", () => {
    pasangDenganSatuBaris();
    expect(screen.getByLabelText(/jumlah pax baris 1/i)).toBeTruthy();
  });

  it("menawarkan 1 sebagai pengali bawaannya", () => {
    // Pax ikut mengalikan nilai baris, dan kosong berarti satu. Angka itu
    // ditampilkan supaya yang mengetik tahu barisnya tidak akan bernilai
    // nol kalau kolomnya dibiarkan kosong.
    pasangDenganSatuBaris();

    const isian = screen.getByLabelText(/jumlah pax baris 1/i) as HTMLInputElement;
    expect(isian.placeholder).toBe("1");
    expect(isian.value, "pax terisi sendiri, padahal seharusnya hanya tawaran").toBe("");
  });
});

describe("FormDokumen — referensi PO", () => {
  /*
   * Kolomnya HANYA ADA DI TABEL INVOICES. Memunculkannya di formulir
   * quotation akan membuat yang mengetiknya mengira nomor itu tersimpan,
   * padahal hilang begitu disimpan — tanpa galat apa pun, sebab nilainya
   * memang tidak pernah dikirim ke tabel mana pun.
   */
  function pasangDengan(pakai: boolean) {
    render(
      <FormDokumen
        isiAwal={ISI_AWAL}
        aksi={async () => ({})}
        istilah={ISTILAH}
        pelanggan={PELANGGAN}
        produk={[]}
        penandatangan={[]}
        pakaiReferensiPo={pakai}
      />,
    );
  }

  it("ada pada invoice", () => {
    pasangDengan(true);
    expect(screen.getByLabelText(/referensi po/i)).toBeTruthy();
  });

  it("TIDAK ADA ketika tidak diminta halamannya", () => {
    pasangDengan(false);
    expect(screen.queryByLabelText(/referensi po/i)).toBeNull();
  });

  it("tidak muncul kalau prop-nya tidak disebut sama sekali", () => {
    // Bawaannya mati. Quotation tidak perlu menyebut apa pun untuk
    // memastikan kolomnya tidak ikut.
    render(
      <FormDokumen
        isiAwal={ISI_AWAL}
        aksi={async () => ({})}
        istilah={ISTILAH}
        pelanggan={PELANGGAN}
        produk={[]}
        penandatangan={[]}
      />,
    );

    expect(screen.queryByLabelText(/referensi po/i)).toBeNull();
  });
});

describe("FormDokumen — kepala bagian", () => {
  /*
   * Formulir ini panjang. Tanpa kepala bagian yang jelas ia terbaca sebagai
   * satu daftar isian tanpa ujung, dan yang mengisinya tidak punya cara
   * mengetahui sudah sampai mana.
   *
   * Nomornya dihitung CSS, bukan ditulis di tiap pemanggilan. jsdom tidak
   * menjalankan penghitung CSS, jadi yang diuji di sini adalah MEKANISMENYA
   * TERPASANG: wadahnya mengatur ulang penghitung, dan tiap bagian membawa
   * penandanya. Kalau salah satu lepas, nomornya hilang atau mengulang dari
   * satu di tiap bagian — dan tidak ada galat apa pun yang menunjukkannya.
   */
  function pasangFormulir() {
    return render(
      <FormDokumen
        isiAwal={ISI_AWAL}
        aksi={async () => ({})}
        istilah={ISTILAH}
        pelanggan={PELANGGAN}
        produk={[]}
        penandatangan={[]}
      />,
    );
  }

  it("wadahnya mengatur ulang penghitung bagian", () => {
    const { container } = pasangFormulir();
    expect(container.querySelector("form")?.className).toContain("daftar-bagian");
  });

  it("tiap bagian punya penanda nomornya", () => {
    const { container } = pasangFormulir();

    const judul = container.querySelectorAll("h2");
    const nomor = container.querySelectorAll(".nomor-bagian");

    expect(judul.length, "formulirnya kehilangan kepala bagian").toBeGreaterThan(3);
    expect(nomor.length, "ada bagian tanpa nomor").toBe(judul.length);
  });

  it("nomornya tidak ditulis sebagai teks, supaya tidak bisa meleset", () => {
    // Angka yang ditulis tangan meleset begitu satu bagian disisipkan di
    // tengah — dan bagian Penandatangan memang hanya muncul ketika
    // penandatangannya lebih dari satu.
    const { container } = pasangFormulir();

    for (const tanda of container.querySelectorAll(".nomor-bagian")) {
      expect(tanda.textContent, "nomornya ditulis tangan").toBe("");
    }
  });

  it("dipakai quotation maupun invoice, dengan istilahnya masing-masing", () => {
    // Satu komponen melayani keduanya. Judul bagian rinciannya mengikuti
    // istilah dokumennya, jadi quotation tidak menyebut "Rincian invoice".
    const { container } = render(
      <FormDokumen
        isiAwal={ISI_AWAL}
        aksi={async () => ({})}
        istilah={{ ...ISTILAH, kata: "quotation" }}
        pelanggan={PELANGGAN}
        produk={[]}
        penandatangan={[]}
      />,
    );

    const judul = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(judul).toContain("Rincian quotation");
    expect(judul).not.toContain("Rincian invoice");
  });
});
