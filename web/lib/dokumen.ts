import type { Decimal } from "decimal.js";
import { z } from "zod";

import { BATAS_CATATAN, BATAS_SYARAT } from "./batas";
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
  unit: z.string().trim().max(255).nullable().optional(),
  qty: z.string().optional(),
  price: z.string().optional(),
});

const barisItem = z.object({
  product_id: z.string().trim().nullable().optional(),
  item_name: z.string().trim().min(1, "Nama item belum diisi.").max(255),
  unit: z.string().trim().max(255).nullable().optional(),
  qty: z.string(),
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
  event_date: z.string().nullable().optional(),
  event_days: z.string().nullable().optional(),
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
  show_payment_terms: z.boolean().default(false),
  payment_terms: z.string().trim().max(BATAS_SYARAT).nullable().optional(),
  items: z.array(barisItem).min(1, "Tambahkan minimal satu item."),
});

export type IsiDokumenTervalidasi = z.infer<typeof skemaDokumen>;
export type AnakSiap = {
  item_name: string;
  unit: string | null;
  qtyD: Decimal;
  priceD: Decimal;
};

export type BarisSiap = z.infer<typeof barisItem> & {
  qtyD: Decimal;
  priceD: Decimal;
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

    // Sebuah baris induk menjadi JUDUL KELOMPOK begitu salah satu
    // sub-itemnya berharga — bentuk "ANEKA STALL" pada dokumen katering.
    // Isian qty dan harga induknya tidak perlu dikosongkan sendiri; ia
    // diabaikan, dan itu diputuskan oleh anaknya.
    const kepalaKelompok = baris.children.some((a) => {
      const q = uraikanRupiah(a.qty ?? "");
      const h = uraikanRupiah(a.price ?? "");
      return q !== null && h !== null && q.times(h).gt(0);
    });

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
    if (!kepalaKelompok && (qty === null || qty.lte(0))) {
      return {
        ok: false,
        keadaan: {
          galat: {
            items: `Baris ${i + 1}: jumlah harus lebih dari nol. Kalau baris ini judul kelompok, isi dulu jumlah dan harga pada sub-itemnya.`,
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
    }

    // Judul kelompok DISIMPAN bernilai nol, bukan sekadar disembunyikan saat
    // ditampilkan. Angka yang tersimpan lalu sejalan dengan yang tercetak,
    // dan tidak ada tempat kedua yang harus ingat mengabaikannya.
    items.push({
      ...baris,
      qtyD: kepalaKelompok ? d(0) : (qty ?? d(0)),
      priceD: kepalaKelompok ? d(0) : (price ?? d(0)),
      anakSiap: baris.children.map((a) => ({
        item_name: a.item_name,
        unit: a.unit ?? null,
        qtyD: uraikanRupiah(a.qty ?? "") ?? d(0),
        priceD: uraikanRupiah(a.price ?? "") ?? d(0),
      })),
    });
  }

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

    const nilai = teks === "" ? d(0) : uraikanRupiah(teks);
    if (nilai === null || nilai.isNegative()) {
      return {
        ok: false,
        keadaan: {
          galat: { biaya_tambahan: `Biaya tambahan ${i + 1}: isi angka saja, dan tidak boleh minus.` },
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
      qty: b.qtyD,
      price: b.priceD,
      is_compliment: b.is_compliment,
      charge_service: b.charge_service,
      charge_pb1: b.charge_pb1,
      children: b.anakSiap.map((a) => ({ qty: a.qtyD, price: a.priceD })),
    })),
    service_charge_percent: f.service_charge_percent ?? null,
    pb1_enabled: f.pb1_enabled,
    pb1_percent: f.pb1_percent ?? 10,
    delivery_amount: uraikanRupiah(f.delivery_amount) ?? 0,
    biaya_tambahan: tambahan,
  });

  return {
    ok: true,
    f,
    items,
    tambahan,
    kolom: {
      customer_id: BigInt(f.customer_id),
      contact_person: kosongkanStrip(f.contact_person),
      contact_phone: kosongkanStrip(f.contact_phone),
      event_date: f.event_date ? new Date(f.event_date) : null,
      event_days: angkaBulat(f.event_days),
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
      show_payment_terms: f.show_payment_terms,
      payment_terms: f.show_payment_terms ? f.payment_terms || null : null,
      updated_at: new Date(),
    },
  };
}

/** Baris item siap simpan, beserta daftar nama sub-itemnya. */
export function barisUntukDisimpan(items: BarisSiap[]) {
  return items.map((b) => ({
    induk: {
      product_id: b.product_id ? BigInt(b.product_id) : null,
      item_name: b.item_name,
      unit: b.unit || null,
      qty: b.qtyD.toFixed(2),
      price: b.priceD.toFixed(2),
      subtotal: (b.is_compliment ? d(0) : b.qtyD.times(b.priceD)).toFixed(2),
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
        qty: a.qtyD.toFixed(2),
        price: a.priceD.toFixed(2),
        // Compliment menurun dari induknya, jadi nilainya ikut nol.
        subtotal: (b.is_compliment ? d(0) : a.qtyD.times(a.priceD)).toFixed(2),
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
