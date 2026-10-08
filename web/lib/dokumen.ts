import type { Decimal } from "decimal.js";
import { z } from "zod";

import { BATAS_CATATAN, BATAS_SYARAT } from "./batas";
import { rapikanTanggal } from "./tanggal";
import { d, hitungTotalDokumen, uraikanRupiah } from "./uang";

/* ==========================================================================
   ISI DOKUMEN PENJUALAN

   Penawaran dan tagihan menyimpan isi yang sama persis — pelanggan, detail
   acara, baris item bertingkat, service charge, PB1, syarat pembayaran.
   Yang berbeda hanya nama tabel, nama kolom tanggal, dan penomorannya.

   Validasi dan perhitungannya dikumpulkan di sini supaya keduanya tidak bisa
   menyimpang satu sama lain. Kalau tagihan hasil konversi menghitung berbeda
   dari penawaran asalnya, pelanggan yang menemukannya lebih dulu.
   ========================================================================== */

export type KeadaanDokumen = {
  pesan?: string;
  galat?: Record<string, string>;
};

const barisAnak = z.object({
  item_name: z.string().trim().max(255),
  day: z.string().optional(),
  unit: z.string().trim().max(255).nullable().optional(),
  qty: z.string().optional(),
  pax: z.string().optional(),
  price: z.string().optional(),
});

const barisItem = z.object({
  product_id: z.string().trim().nullable().optional(),
  day: z.string().optional(),
  item_name: z.string().trim().min(1, "Nama item belum diisi.").max(255),
  unit: z.string().trim().max(255).nullable().optional(),
  qty: z.string(),
  /**
   * Berapa ORANG yang dilayani baris ini.
   *
   * Berbeda dari qty, dan sengaja: qty beserta satuannya menerangkan bentuk
   * penyajiannya — 2 Tampah, 35 Box — sedangkan pax menerangkan berapa orang
   * yang makan. Satu tampah bisa untuk dua puluh orang.
   *
   * TIDAK PERNAH IKUT MENGHITUNG UANG. Nilainya murni keterangan untuk
   * dapur. Kalau ia sampai ikut dikalikan, nilai dokumen berubah tanpa ada
   * satu pun angka harga yang disentuh.
   */
  pax: z.string().optional(),
  price: z.string(),
  is_compliment: z.boolean().default(false),
  charge_service: z.boolean().default(true),
  charge_pb1: z.boolean().default(true),
  children: z.array(barisAnak).default([]),
});

/**
 * Satu baris biaya tambahan — namanya bebas, jumlahnya di luar PB1 dan
 * service charge. Lihat `MasukanTotal.biaya_tambahan` di uang.ts.
 */
const barisTambahan = z.object({
  label: z.string().trim().max(255),
  amount: z.string().optional(),
});

export const skemaDokumen = z.object({
  id: z.string().trim().optional().nullable(),
  customer_id: z.string().trim().min(1, "Customer belum dipilih."),
  contact_person: z.string().trim().max(255).nullable().optional(),
  contact_phone: z.string().trim().max(255).nullable().optional(),
  tanggal: z.string().min(1, "Tanggal belum diisi."),
  tanggal_akhir: z.string().min(1, "Tanggal belum diisi."),
  // Satu dokumen bisa menanggung acara beberapa hari, dan tanggalnya tidak
  // selalu berurutan. "Jumlah hari" TIDAK diterima dari formulir — ia
  // dihitung dari banyaknya tanggal, supaya keduanya tidak bisa berbeda.
  event_dates: z.array(z.string()).default([]),
  event_type: z.string().trim().max(255).nullable().optional(),
  event_time: z.string().trim().max(255).nullable().optional(),
  guest_count: z.string().nullable().optional(),
  fnb_planner: z.string().trim().max(255).nullable().optional(),
  venue: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(BATAS_CATATAN).nullable().optional(),
  service_charge_percent: z.string().nullable().optional(),
  delivery_amount: z.string().nullable().optional(),
  biaya_tambahan: z.array(barisTambahan).default([]),
  pb1_enabled: z.boolean().default(false),
  pb1_percent: z.string().nullable().optional(),
  signatory_id: z.string().trim().nullable().optional(),
  show_payment_terms: z.boolean().default(false),
  payment_terms: z.string().trim().max(BATAS_SYARAT).nullable().optional(),
  items: z.array(barisItem).min(1, "Tambahkan minimal satu item."),
});

export type IsiDokumenTervalidasi = z.infer<typeof skemaDokumen>;
export type AnakSiap = {
  item_name: string;
  unit: string | null;
  dayD: Decimal;
  qtyD: Decimal;
  priceD: Decimal;
  /** Null berarti tidak diisi — bukan nol orang. */
  pax: number | null;
};

export type BarisSiap = z.infer<typeof barisItem> & {
  dayD: Decimal;
  qtyD: Decimal;
  priceD: Decimal;
  paxAngka: number | null;
  anakSiap: AnakSiap[];
};

/** Baris biaya tambahan yang sudah bersih dan siap disimpan. */
export type BarisTambahanSiap = { label: string; amount: Decimal };

export type HasilSiap =
  | {
      ok: true;
      f: IsiDokumenTervalidasi;
      items: BarisSiap[];
      tambahan: BarisTambahanSiap[];
      tanggalAcara: Date[];
      kolom: KolomDokumen;
    }
  | { ok: false; keadaan: KeadaanDokumen };

/** Kolom-kolom yang sama untuk quotations maupun invoices. */
export type KolomDokumen = {
  customer_id: bigint;
  contact_person: string | null;
  contact_phone: string | null;
  event_date: Date | null;
  event_days: number | null;
  event_type: string | null;
  event_time: string | null;
  guest_count: number | null;
  fnb_planner: string | null;
  venue: string | null;
  notes: string | null;
  subtotal: string;
  service_charge_percent: string | null;
  service_charge_amount: string;
  pb1_enabled: boolean;
  pb1_percent: string | null;
  pb1_amount: string;
  delivery_amount: string;
  grand_total: string;
  signatory_id: bigint | null;
  show_payment_terms: boolean;
  payment_terms: string | null;
  updated_at: Date;
};

/**
 * Isian yang hanya berisi tanda hubung dianggap KOSONG.
 *
 * Orang mengetik "-" untuk menyatakan "tidak ada" — kebiasaan dari mengisi
 * formulir kertas. Aplikasi lalu memperlakukannya sebagai isi yang sah, dan
 * hasilnya muncul di dokumen yang dikirim ke klien: judul "INVOICE - -",
 * karena jenis acaranya memang berisi satu tanda hubung.
 *
 * Yang dikosongkan hanya nilai yang SELURUHNYA tanda hubung. "The Telkom Hub
 * - Jl. Gatot Subroto" tetap utuh.
 */
function kosongkanStrip(nilai: string | null | undefined): string | null {
  const bersih = (nilai ?? "").trim();
  if (bersih === "" || /^[-–—]+$/.test(bersih)) return null;
  return bersih;
}

function angkaBulat(teks: unknown): number | null {
  const nilai = uraikanRupiah(teks);
  if (nilai === null) return null;
  const bulat = nilai.toNumber();
  return Number.isFinite(bulat) ? Math.trunc(bulat) : null;
}

/**
 * Membaca muatan formulir, memvalidasinya, lalu menghitung ulang seluruh
 * totalnya di server.
 *
 * Angka yang dikirim browser tidak pernah dipercaya — yang disimpan selalu
 * hasil hitungan di sini, memakai rumus yang sudah dikunci tes di uang.ts.
 */
export function siapkanDokumen(
  mentah: unknown,
  opsi: { labelTanggalAkhir: string },
): HasilSiap {
  const hasil = skemaDokumen.safeParse(mentah);

  if (!hasil.success) {
    const rata = z.flattenError(hasil.error);
    const galat: Record<string, string> = {};
    for (const [kunci, pesan] of Object.entries(rata.fieldErrors)) {
      if (pesan?.[0]) galat[kunci] = pesan[0];
    }
    return {
      ok: false,
      keadaan: {
        galat,
        pesan: rata.formErrors[0] ?? "Ada isian yang belum benar. Periksa tanda merah.",
      },
    };
  }

  const f = hasil.data;

  // Diperiksa di sini, bukan di dalam skema, supaya pesannya bisa menyebut
  // baris ke berapa yang bermasalah.
  const items: BarisSiap[] = [];
  for (const [i, baris] of f.items.entries()) {
    const qty = uraikanRupiah(baris.qty);
    const price = uraikanRupiah(baris.price);

    // Hari. Kosong berarti SATU — itu yang membuat seluruh dokumen yang
    // sudah terbit menghasilkan angka yang sama persis seperti sebelumnya.
    // Nol ditolak, bukan dianggap satu: baris berhari nol tidak menagih apa
    // pun, dan dokumennya tetap terlihat wajar.
    const teksHari = String(baris.day ?? "").trim();
    const hari = teksHari === "" ? d(1) : uraikanRupiah(teksHari);

    if (hari === null) {
      return {
        ok: false,
        keadaan: { galat: { items: `Baris ${i + 1}: jumlah hari tidak terbaca. Isi angka saja, contoh: 3.` } },
      };
    }
    if (hari.lt(1)) {
      return {
        ok: false,
        keadaan: { galat: { items: `Baris ${i + 1}: jumlah hari minimal 1.` } },
      };
    }

    // Baris tanpa jumlah DAN tanpa harga tidak mungkin salah ketik yang
    // merugikan: salah ketik yang merugikan adalah harga yang terisi tetapi
    // jumlahnya nol — customer tidak jadi ditagih untuk sesuatu yang memang
    // hendak ditagihkan. Baris yang kedua kolomnya nol tidak pernah hendak
    // menagih apa pun, jadi ia judul.
    //
    // PUNYA SUB-ITEM BERHARGA TIDAK MENJADIKAN INDUKNYA JUDUL. "Day 1 -
    // LUNCH BUFFET 35 pax" dengan sub-item "VEGETARIAN 2 pax" adalah 37
    // porsi yang ditagihkan; menganggap induknya judul membuang 35 porsinya.
    const tanpaAngka =
      (qty === null || qty.isZero()) && (price === null || price.isZero());

    // ISIAN KOSONG BERARTI NOL, bukan galat. Pada judul kelompok, kolom
    // harga memang ditinggal kosong — angkanya ada di sub-itemnya. Sebelum
    // ini, kolom kosong terbaca sebagai "tidak terbaca" lalu dilaporkan
    // sebagai harga minus, dan orang mencari angka minus yang tidak pernah
    // ada di formulirnya.
    const qtyKosong = String(baris.qty ?? "").trim() === "";
    const hargaKosong = String(baris.price ?? "").trim() === "";

    if (!hargaKosong && price === null) {
      return {
        ok: false,
        keadaan: { galat: { items: `Baris ${i + 1}: harga tidak terbaca. Isi angka saja, contoh: 250.000.` } },
      };
    }
    if (price !== null && price.isNegative()) {
      return { ok: false, keadaan: { galat: { items: `Baris ${i + 1}: harga tidak boleh minus.` } } };
    }

    if (!qtyKosong && qty === null) {
      return {
        ok: false,
        keadaan: { galat: { items: `Baris ${i + 1}: jumlah tidak terbaca. Isi angka saja, contoh: 35.` } },
      };
    }
    if (qty !== null && qty.isNegative()) {
      return { ok: false, keadaan: { galat: { items: `Baris ${i + 1}: jumlah tidak boleh minus.` } } };
    }

    // Yang tersisa untuk ditolak hanyalah keadaan yang benar-benar
    // merugikan: harganya terisi, tetapi jumlahnya nol. Baris itu tidak akan
    // menagih apa pun, padahal jelas dimaksudkan menagih.
    if (!tanpaAngka && (qty === null || qty.lte(0))) {
      return {
        ok: false,
        keadaan: {
          galat: {
            items: `Baris ${i + 1}: harganya terisi tetapi jumlahnya nol, jadi baris ini tidak akan menagih apa pun. Isi jumlahnya — atau kosongkan harganya kalau baris ini memang hanya judul.`,
          },
        },
      };
    }

    for (const [j, anak] of baris.children.entries()) {
      const qtyAnak = uraikanRupiah(anak.qty ?? "");
      const hargaAnak = uraikanRupiah(anak.price ?? "");

      if ((anak.qty ?? "").trim() !== "" && (qtyAnak === null || qtyAnak.isNegative())) {
        return {
          ok: false,
          keadaan: { galat: { items: `Baris ${i + 1} sub-item ${j + 1}: jumlah tidak boleh minus.` } },
        };
      }
      if ((anak.price ?? "").trim() !== "" && (hargaAnak === null || hargaAnak.isNegative())) {
        return {
          ok: false,
          keadaan: { galat: { items: `Baris ${i + 1} sub-item ${j + 1}: harga tidak boleh minus.` } },
        };
      }

      // Hari sub-item yang DIBIARKAN KOSONG berarti "sama seperti induknya",
      // bukan satu. Satu stall yang disajikan tiga hari berarti seluruh
      // isinya tiga hari; memaksanya diketik ulang di setiap sub-item hanya
      // membuka peluang keduanya menyimpang.
      const teksHariAnak = String(anak.day ?? "").trim();
      if (teksHariAnak !== "") {
        const hariAnak = uraikanRupiah(teksHariAnak);
        if (hariAnak === null) {
          return {
            ok: false,
            keadaan: { galat: { items: `Baris ${i + 1} sub-item ${j + 1}: jumlah hari tidak terbaca.` } },
          };
        }
        if (hariAnak.lt(1)) {
          return {
            ok: false,
            keadaan: { galat: { items: `Baris ${i + 1} sub-item ${j + 1}: jumlah hari minimal 1.` } },
          };
        }
      }
    }

    // Judul kelompok DISIMPAN bernilai nol, bukan sekadar disembunyikan saat
    // ditampilkan. Angka yang tersimpan lalu sejalan dengan yang tercetak,
    // dan tidak ada tempat kedua yang harus ingat mengabaikannya.
    // Angkanya disimpan apa adanya. Baris judul bernilai nol dengan
    // sendirinya — qty kali harganya memang nol — jadi tidak ada yang perlu
    // dipaksa, dan tidak ada tempat kedua yang harus ingat memaksanya.
    items.push({
      ...baris,
      dayD: hari,
      qtyD: qty ?? d(0),
      priceD: price ?? d(0),
      paxAngka: bacaPax(baris.pax),
      anakSiap: baris.children.map((a) => ({
        item_name: a.item_name,
        unit: a.unit ?? null,
        // Kosong berarti mengikuti induknya.
        dayD: uraikanRupiah(String(a.day ?? "").trim()) ?? hari,
        qtyD: uraikanRupiah(a.qty ?? "") ?? d(0),
        priceD: uraikanRupiah(a.price ?? "") ?? d(0),
        pax: bacaPax(a.pax),
      })),
    });
  }

  // Tanggal acara. Dikirim sebagai "2026-05-10" oleh pemilih tanggal, dan
  // dibaca sebagai TENGAH MALAM UTC — bukan tengah malam setempat. Kolomnya
  // bertipe DATE; tengah malam setempat di zona timur akan tersimpan mundur
  // satu hari, dan acara yang tercetak bergeser sehari tanpa gejala apa pun.
  const tanggalAcara: Date[] = [];
  for (const [i, mentahTanggal] of f.event_dates.entries()) {
    const teks = String(mentahTanggal ?? "").trim();
    if (teks === "") continue;

    // Dirakit dari potongannya, BUKAN diserahkan ke new Date(teks).
    // new Date("2026-05-10") kebetulan menghasilkan tengah malam UTC, tetapi
    // itu perilaku yang bergantung pada bentuk teksnya: new Date("2026")
    // menjadi 1 Januari, dan bentuk lain menjadi tengah malam SETEMPAT —
    // yang di zona timur tersimpan mundur sehari pada kolom bertipe DATE.
    // Dokumennya tetap terbit, hanya menyebutkan hari yang salah.
    const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
    const tanggal = cocok
      ? new Date(Date.UTC(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3])))
      : null;

    if (!tanggal || Number.isNaN(tanggal.getTime())) {
      return {
        ok: false,
        keadaan: { galat: { event_dates: `Tanggal acara ke-${i + 1} tidak terbaca.` } },
      };
    }
    tanggalAcara.push(tanggal);
  }

  // Diurutkan dan dibuang yang kembar DI SINI, bukan saat ditampilkan.
  // Tanggal kembar yang lolos akan menghitung jumlah hari lebih banyak
  // daripada yang benar-benar terjadi, dan angka itu ikut tercetak.
  const tanggalRapi = rapikanTanggal(tanggalAcara);

  const teksDelivery = String(f.delivery_amount ?? "").trim();
  if (teksDelivery !== "" && uraikanRupiah(teksDelivery) === null) {
    return {
      ok: false,
      keadaan: { galat: { delivery_amount: "Isi angka saja, contoh: 250.000" } },
    };
  }

  // Baris biaya tambahan. Baris yang kosong sama sekali DIBUANG tanpa
  // keluhan — orang menambah baris lalu berubah pikiran, dan memaksanya
  // menghapus baris kosong sebelum boleh menyimpan hanya menghalangi.
  //
  // Yang tidak boleh lolos adalah jumlah tanpa nama: angka tanpa keterangan
  // di dokumen yang dikirim ke customer akan ditanyakan balik, dan saat itu
  // tidak ada seorang pun yang masih ingat untuk apa.
  const tambahan: { label: string; amount: Decimal }[] = [];
  for (const [i, baris] of f.biaya_tambahan.entries()) {
    const label = baris.label.trim();
    const teks = String(baris.amount ?? "").trim();

    if (label === "" && teks === "") continue;

    // MINUS DIIZINKAN di sini, tidak seperti pada baris item. Pembulatan
    // dan diskon adalah baris yang MENGURANGI, dan keduanya memang ditulis
    // di tempat ini pada dokumen katering: "Rounded -65.000".
    //
    // Pada baris item minus tetap ditolak, karena di sana ia selalu salah
    // ketik — potongan tidak pernah ditulis sebagai harga satuan minus.
    const nilai = teks === "" ? d(0) : uraikanRupiah(teks);
    if (nilai === null) {
      return {
        ok: false,
        keadaan: {
          galat: {
            biaya_tambahan: `Biaya tambahan ${i + 1}: isi angka saja — contoh 350.000, atau -65.000 untuk potongan.`,
          },
        },
      };
    }
    if (label === "") {
      return {
        ok: false,
        keadaan: {
          galat: { biaya_tambahan: `Biaya tambahan ${i + 1}: namanya belum diisi.` },
        },
      };
    }

    tambahan.push({ label, amount: nilai });
  }

  if (new Date(f.tanggal_akhir) < new Date(f.tanggal)) {
    return {
      ok: false,
      keadaan: {
        galat: { tanggal_akhir: `${opsi.labelTanggalAkhir} tidak boleh sebelum tanggalnya.` },
      },
    };
  }

  const total = hitungTotalDokumen({
    items: items.map((b) => ({
      day: b.dayD,
      qty: b.qtyD,
      pax: b.paxAngka,
      price: b.priceD,
      is_compliment: b.is_compliment,
      charge_service: b.charge_service,
      charge_pb1: b.charge_pb1,
      children: b.anakSiap.map((a) => ({
        day: a.dayD,
        qty: a.qtyD,
        pax: a.pax,
        price: a.priceD,
      })),
    })),
    service_charge_percent: f.service_charge_percent ?? null,
    pb1_enabled: f.pb1_enabled,
    pb1_percent: f.pb1_percent ?? 10,
    delivery_amount: uraikanRupiah(f.delivery_amount) ?? 0,
    biaya_tambahan: tambahan,
  });

  // Sejak potongan diizinkan, total dokumen bisa menjadi MINUS — dan dokumen
  // bertotal minus berarti perusahaan yang berutang kepada customer. Hampir
  // selalu itu satu angka nol kelebihan pada baris potongan.
  //
  // Dijaga di sini, bukan dengan membatasi besar potongannya: potongan yang
  // tepat sebesar nilai dokumen itu sah — acara yang digratiskan seluruhnya.
  if (total.grand_total.isNegative()) {
    return {
      ok: false,
      keadaan: {
        galat: {
          biaya_tambahan: `Potongannya melebihi nilai dokumen, jadi totalnya menjadi ${total.grand_total.toFixed(0)}. Periksa lagi angkanya.`,
        },
      },
    };
  }

  return {
    ok: true,
    f,
    items,
    tambahan,
    tanggalAcara: tanggalRapi,
    kolom: {
      customer_id: BigInt(f.customer_id),
      contact_person: kosongkanStrip(f.contact_person),
      contact_phone: kosongkanStrip(f.contact_phone),
      // Tanggal paling awal tetap disimpan di kolomnya sendiri: daftar
      // quotation memakainya, dan membiarkannya berarti tidak ada tempat
      // lain yang perlu ikut berubah.
      event_date: tanggalRapi[0] ?? null,
      event_days: tanggalRapi.length > 0 ? tanggalRapi.length : null,
      event_type: kosongkanStrip(f.event_type),
      event_time: kosongkanStrip(f.event_time),
      guest_count: angkaBulat(f.guest_count),
      fnb_planner: kosongkanStrip(f.fnb_planner),
      venue: kosongkanStrip(f.venue),
      notes: kosongkanStrip(f.notes),
      subtotal: total.subtotal.toFixed(2),
      service_charge_percent: f.service_charge_percent
        ? d(f.service_charge_percent).toFixed(2)
        : null,
      service_charge_amount: total.service_charge_amount.toFixed(2),
      pb1_enabled: f.pb1_enabled,
      pb1_percent: f.pb1_enabled ? d(f.pb1_percent ?? 10).toFixed(2) : null,
      pb1_amount: total.pb1_amount.toFixed(2),
      delivery_amount: total.delivery_amount.toFixed(2),
      grand_total: total.grand_total.toFixed(2),
      // Kosong berarti memakai penandatangan pertama saat dicetak, bukan
      // tanpa tanda tangan.
      signatory_id: f.signatory_id ? BigInt(f.signatory_id) : null,
      show_payment_terms: f.show_payment_terms,
      payment_terms: f.show_payment_terms ? f.payment_terms || null : null,
      updated_at: new Date(),
    },
  };
}

/**
 * Membaca isian pax: bilangan bulat tidak negatif, atau null.
 *
 * KOSONG BERARTI TIDAK DIISI, bukan nol orang. Nol yang tersimpan akan
 * tercetak di lembar dapur sebagai "0", dan itu terbaca sebagai perintah
 * untuk tidak memasaknya.
 */
export function bacaPax(nilai: string | undefined): number | null {
  const teks = String(nilai ?? "").trim();
  if (teks === "") return null;

  const angka = uraikanRupiah(teks);
  if (angka === null || angka.isNegative() || !angka.isInteger()) return null;

  return angka.toNumber();
}

/**
 * Pengali pax, dengan aturan yang SAMA PERSIS dengan paksBaris di
 * lib/uang.ts: kosong atau nol berarti satu.
 *
 * Dua tempat menghitung nilai baris — rumus dokumen di lib/uang.ts dan
 * angka yang DISIMPAN di sini. Keduanya harus memperlakukan pax kosong
 * dengan cara yang sama; kalau tidak, dokumen menagih angka yang tidak
 * sama dengan jumlah rinciannya sendiri.
 */
function paksSiap(pax: number | null): Decimal {
  return pax === null || pax === 0 ? d(1) : d(pax);
}

/** Baris item siap simpan, beserta daftar nama sub-itemnya. */
export function barisUntukDisimpan(items: BarisSiap[]) {
  return items.map((b) => ({
    induk: {
      product_id: b.product_id ? BigInt(b.product_id) : null,
      item_name: b.item_name,
      unit: b.unit || null,
      day: b.dayD.toFixed(2),
      qty: b.qtyD.toFixed(2),
      // Pengali nilai barisnya, lihat subtotal di bawah.
      pax: b.paxAngka,
      price: b.priceD.toFixed(2),
      // Hari x qty x pax x harga satuan. Pax kosong berarti satu, jadi
      // dokumen yang terbit sebelum kolom ini ada bernilai sama persis.
      subtotal: (
        b.is_compliment
          ? d(0)
          : b.dayD.times(b.qtyD).times(paksSiap(b.paxAngka)).times(b.priceD)
      ).toFixed(2),
      is_compliment: b.is_compliment,
      charge_service: b.charge_service,
      charge_pb1: b.charge_pb1,
      created_at: new Date(),
      updated_at: new Date(),
    },
    anak: b.anakSiap
      .filter((a) => a.item_name.trim() !== "")
      .map((a) => ({
        item_name: a.item_name.trim(),
        unit: a.unit || null,
        // Hari DISIMPAN juga di barisnya sendiri, bukan hanya dipakai saat
        // menghitung. Baris yang tersimpan berhari 1 sementara nilainya
        // sudah dikali tiga adalah baris yang angkanya tidak menjelaskan
        // nilainya sendiri.
        day: a.dayD.toFixed(2),
        qty: a.qtyD.toFixed(2),
        pax: a.pax,
        price: a.priceD.toFixed(2),
        // Compliment menurun dari induknya; hari sudah diselesaikan di atas.
        subtotal: (
          b.is_compliment
            ? d(0)
            : a.dayD.times(a.qtyD).times(paksSiap(a.pax)).times(a.priceD)
        ).toFixed(2),
      })),
  }));
}

/** Membaca muatan JSON dari formulir. */
export function bacaMuatan(data: FormData): unknown | null {
  try {
    return JSON.parse(String(data.get("muatan") ?? ""));
  } catch {
    return null;
  }
}

/**
 * Mengubah galat menjadi satu kalimat yang layak dibaca pengguna.
 *
 * Galat yang dilempar sendiri oleh aturan bisnis sudah berupa kalimat utuh —
 * itu yang ditampilkan. Galat dari Prisma atau jaringan panjang dan penuh
 * istilah, jadi diganti kalimat umum.
 *
 * Yang panjang itu WAJIB tetap dicatat ke log server. Pernah terjadi seluruh
 * tagihan baru gagal disimpan di produksi, dan satu-satunya petunjuk yang
 * sampai ke layar hanyalah "Tagihan gagal disimpan" — sebabnya, kalimat
 * Prisma yang menjelaskan persoalannya dibuang tanpa dicatat di mana pun.
 */
export function pesanGagal(galat: unknown, cadangan: string): { pesan: string } {
  if (galat instanceof Error && galat.message.length < 250) {
    return { pesan: galat.message };
  }

  console.error(cadangan, galat);
  return { pesan: cadangan };
}
