import { nilaiKelompok, perluTotalKelompok, romawi, rupiah } from "./uang";

/* ==========================================================================
   SUSUNAN BARIS DOKUMEN CETAK

   Dipakai DUA kali: tabel di halaman cetak, dan berkas Excel yang diunduh
   dari dokumen yang sama. Keduanya harus menghasilkan baris yang persis
   sama — kalau tidak, customer memegang kertas dan berkas yang menyebut
   angka berbeda untuk satu pesanan, dan tidak ada yang akan menyadarinya
   sampai salah satunya dipakai menagih.

   Aturan-aturan di bawah ini yang menyimpan seluruh keputusannya. Semuanya
   pernah salah sekali, dan tidak satu pun menimbulkan galat:

   1. BARIS JUDUL ditentukan oleh ANGKANYA SENDIRI (qty x harga = 0), bukan
      oleh ada tidaknya sub-item berharga. "LUNCH BUFFET 35 pax" yang punya
      tambahan "VEGETARIAN 2 pax" tetap menagih 35 porsinya sendiri. Aturan
      yang menilainya dari anaknya pernah membuang empat baris LUNCH BUFFET
      dan membuat subtotalnya 17.830.000, padahal seharusnya 44.955.000.

   2. KOLOM ANGKA PADA BARIS JUDUL DIKOSONGKAN, bukan diisi nol. Nol terbaca
      sebagai harga, dan pembacanya akan mencari-cari apa yang berharga nol.

   3. SUB-ITEM BERHARGA mendapat barisnya sendiri (I.1, I.2); yang tidak
      berharga menumpang di kolom deskripsi induknya sebagai rincian isi
      paket. Keduanya dipakai di dokumen katering yang sama.

   4. TOTAL KELOMPOK hanya memuat baris kelompok itu. Service charge, PB1,
      delivery, dan biaya tambahan dihitung sekali di blok bawah — dengan
      begitu Sub Total selalu sama persis dengan jumlah seluruh total
      kelompok, tanpa perlu mencocokkan pembulatan di dua tempat.
   ========================================================================== */

export type ItemCetak = {
  id: string;
  item_name: string;
  unit: string | null;
  day: string;
  qty: string;
  price: string;
  subtotal: string;
  is_compliment: boolean;
  anak: {
    id: string;
    item_name: string;
    unit: string | null;
    day: string;
    qty: string;
    price: string;
    subtotal: string;
  }[];
};

/** Satu baris pada tabel rincian, sudah siap digambar maupun ditulis. */
export type BarisTabel =
  | {
      jenis: "item";
      kunci: string;
      nomor: string;
      nama: string;
      /** Isi paket yang tidak berharga, ditulis di bawah namanya. */
      rincian: string[];
      /** Kosong berarti baris judul: kolomnya memang dikosongkan. */
      hari: string;
      qty: string;
      satuan: string;
      harga: string;
      nilai: string;
      /**
       * Angka mentahnya, untuk berkas Excel. Null berarti selnya memang
       * dikosongkan — baris judul, atau item compliment.
       *
       * Keputusan "sel ini kosong" tetap diambil SEKALI di sini. Yang
       * berbeda antara kertas dan Excel hanya cara menuliskannya: kertas
       * memakai "Rp 1.520.000", Excel memakai angka yang bisa dijumlah.
       */
      hariAngka: number | null;
      qtyAngka: number | null;
      hargaAngka: number | null;
      nilaiAngka: number | null;
      /** Baris judul kelompok, yang tidak menagih apa pun. */
      judul: boolean;
      /** Sub-item berharga, digambar menjorok. */
      menjorok: boolean;
    }
  | {
      jenis: "totalKelompok";
      kunci: string;
      label: string;
      nilai: string;
      nilaiAngka: number;
    };

export type BarisTotal = {
  kunci: string;
  label: string;
  nilai: string;
  nilaiAngka: number;
  /** Baris TOTAL paling bawah. */
  akhir: boolean;
};

const angka = (nilai: string) => Number(nilai).toLocaleString("id-ID");

/**
 * Membuang nol di belakang koma: 5.00 -> 5, 7.50 -> 7,5
 *
 * Dipindahkan apa adanya dari komponen cetaknya. Ditulis ulang dengan
 * toLocaleString, "7,5" akan tetap benar tetapi bentuknya berubah diam-diam
 * pada angka tertentu — dan persentase pajak adalah angka yang dibaca orang
 * pajak.
 */
function persen(nilai: string | null): string {
  if (!nilai) return "0";
  return Number(nilai).toString().replace(".", ",");
}

/** Baris tabel rincian, berurutan dari atas ke bawah. */
export function barisTabelDokumen(daftar: ItemCetak[]): BarisTabel[] {
  const hasil: BarisTabel[] = [];

  daftar.forEach((b, i) => {
    const nomorInduk = romawi(i + 1);
    const anakBerharga = b.anak.filter((a) => Number(a.subtotal) > 0);
    const anakRincian = b.anak.filter((a) => Number(a.subtotal) <= 0);

    // Aturan 1: dinilai dari angkanya sendiri.
    const bernilai = Number(b.qty) * Number(b.price) > 0;

    hasil.push({
      jenis: "item",
      kunci: b.id,
      nomor: nomorInduk,
      nama: b.item_name,
      rincian: anakRincian.map((a) => a.item_name),
      // Aturan 2: dikosongkan, bukan diisi nol.
      hari: bernilai ? angka(b.day) : "",
      qty: bernilai ? angka(b.qty) : "",
      satuan: bernilai ? (b.unit ?? "") : "",
      harga: b.is_compliment ? "Compliment" : bernilai ? rupiah(b.price) : "",
      nilai: b.is_compliment ? "Compliment" : bernilai ? rupiah(b.subtotal) : "",
      hariAngka: bernilai ? Number(b.day) : null,
      qtyAngka: bernilai ? Number(b.qty) : null,
      hargaAngka: b.is_compliment || !bernilai ? null : Number(b.price),
      nilaiAngka: b.is_compliment || !bernilai ? null : Number(b.subtotal),
      judul: !bernilai,
      menjorok: false,
    });

    // Aturan 3.
    anakBerharga.forEach((a, j) => {
      hasil.push({
        jenis: "item",
        kunci: a.id,
        nomor: `${nomorInduk}.${j + 1}`,
        nama: a.item_name,
        rincian: [],
        hari: angka(a.day),
        qty: angka(a.qty),
        satuan: a.unit ?? "",
        harga: b.is_compliment ? "Compliment" : rupiah(a.price),
        nilai: b.is_compliment ? "Compliment" : rupiah(a.subtotal),
        hariAngka: Number(a.day),
        qtyAngka: Number(a.qty),
        hargaAngka: b.is_compliment ? null : Number(a.price),
        nilaiAngka: b.is_compliment ? null : Number(a.subtotal),
        judul: false,
        menjorok: true,
      });
    });

    // Aturan 4.
    const kelompok = { subtotal: b.subtotal, anak: b.anak };
    if (perluTotalKelompok(kelompok)) {
      hasil.push({
        jenis: "totalKelompok",
        kunci: `total-${b.id}`,
        label: `Total - ${nomorInduk}`,
        nilai: rupiah(nilaiKelompok(kelompok)),
        nilaiAngka: Number(nilaiKelompok(kelompok)),
      });
    }
  });

  return hasil;
}

/**
 * Blok total di bawah tabel, berurutan.
 *
 * Delivery dan biaya tambahan sengaja ditaruh SESUDAH kedua pungutan,
 * supaya pembaca dokumen bisa menelusuri perhitungannya dari atas ke bawah
 * dan melihat sendiri bahwa ongkos kirim tidak ikut dipajaki.
 */
export function barisTotalDokumen(isi: {
  subtotal: string;
  service_charge_percent: string | null;
  service_charge_amount: string;
  pb1_enabled: boolean;
  pb1_percent: string | null;
  pb1_amount: string;
  delivery_amount: string;
  biaya_tambahan: { id: string; label: string; amount: string }[];
  grand_total: string;
}): BarisTotal[] {
  const hasil: BarisTotal[] = [
    {
      kunci: "subtotal",
      label: "Sub Total",
      nilai: rupiah(isi.subtotal),
      nilaiAngka: Number(isi.subtotal),
      akhir: false,
    },
  ];

  if (Number(isi.service_charge_amount) > 0) {
    hasil.push({
      kunci: "sc",
      label: `Service Charge (${persen(isi.service_charge_percent)}%)`,
      nilai: rupiah(isi.service_charge_amount),
      nilaiAngka: Number(isi.service_charge_amount),
      akhir: false,
    });
  }

  if (isi.pb1_enabled && Number(isi.pb1_amount) > 0) {
    hasil.push({
      kunci: "pb1",
      label: `PB1 (${persen(isi.pb1_percent)}%)`,
      nilai: rupiah(isi.pb1_amount),
      nilaiAngka: Number(isi.pb1_amount),
      akhir: false,
    });
  }

  if (Number(isi.delivery_amount) > 0) {
    hasil.push({
      kunci: "delivery",
      label: "Delivery",
      nilai: rupiah(isi.delivery_amount),
      nilaiAngka: Number(isi.delivery_amount),
      akhir: false,
    });
  }

  for (const b of isi.biaya_tambahan) {
    hasil.push({
      kunci: `bt-${b.id}`,
      label: b.label,
      nilai: rupiah(b.amount),
      nilaiAngka: Number(b.amount),
      akhir: false,
    });
  }

  hasil.push({
    kunci: "total",
    label: "TOTAL",
    nilai: rupiah(isi.grand_total),
    nilaiAngka: Number(isi.grand_total),
    akhir: true,
  });

  return hasil;
}
