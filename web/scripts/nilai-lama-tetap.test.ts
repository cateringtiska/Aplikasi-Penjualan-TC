import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma";
import { hitungTotalDokumen } from "../lib/uang";

/* ==========================================================================
   DOKUMEN YANG SUDAH TERBIT TIDAK BOLEH BERUBAH NILAINYA

   Rumus satu baris berubah dari HARI x QTY x HARGA menjadi
   HARI x QTY x PAX x HARGA SATUAN. Pax kosong berarti satu, jadi seharusnya
   tidak ada satu pun dokumen terbit yang berubah — tetapi "seharusnya"
   bukan jawaban untuk angka yang sudah ditagihkan ke customer.

   Perubahannya pun TIDAK AKAN TERLIHAT dari layar mana pun: dokumennya
   tetap terbuka, tetap tercetak rapi, hanya totalnya berbeda dari kertas
   yang sudah dipegang orang. Yang menemukannya adalah customer saat
   membayar, atau akuntan saat mencocokkan.

   Jadi seluruh dokumen dihitung ULANG dari rinciannya dengan rumus yang
   berlaku sekarang, lalu dibandingkan dengan angka yang tersimpan.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

const KOLOM_ANAK = {
  select: { day: true, qty: true, pax: true, price: true },
};

type Dokumen = {
  nomor: string;
  grandTotal: string;
  serviceChargePersen: string | null;
  pb1Aktif: boolean;
  pb1Persen: string | null;
  delivery: string;
  biaya: { label: string; amount: string }[];
  items: {
    day: string;
    qty: string;
    pax: number | null;
    price: string;
    is_compliment: boolean;
    charge_service: boolean;
    charge_pb1: boolean;
    children: { day: string; qty: string; pax: number | null; price: string }[];
  }[];
};

function hitungUlang(dok: Dokumen) {
  return hitungTotalDokumen({
    items: dok.items,
    service_charge_percent: dok.serviceChargePersen,
    pb1_enabled: dok.pb1Aktif,
    pb1_percent: dok.pb1Persen ?? 10,
    delivery_amount: dok.delivery,
    biaya_tambahan: dok.biaya,
  });
}

describe("menghitung ulang seluruh dokumen", () => {
  it("invoice yang sudah terbit bernilai sama persis", async () => {
    const semua = await prisma.invoices.findMany({
      where: { status: { not: "cancelled" } },
      include: {
        invoice_charges: true,
        invoice_items: {
          where: { parent_id: null },
          include: { other_invoice_items: KOLOM_ANAK },
        },
      },
    });

    expect(semua.length, "tidak ada invoice untuk diperiksa").toBeGreaterThan(0);

    const beda: string[] = [];
    for (const t of semua) {
      const hasil = hitungUlang({
        nomor: t.invoice_number,
        grandTotal: t.grand_total.toString(),
        serviceChargePersen: t.service_charge_percent?.toString() ?? null,
        pb1Aktif: t.pb1_enabled,
        pb1Persen: t.pb1_percent?.toString() ?? null,
        delivery: t.delivery_amount.toString(),
        biaya: t.invoice_charges.map((c) => ({
          label: c.label,
          amount: c.amount.toString(),
        })),
        items: t.invoice_items.map((b) => ({
          day: b.day.toString(),
          qty: b.qty.toString(),
          pax: b.pax,
          price: b.price.toString(),
          is_compliment: b.is_compliment,
          charge_service: b.charge_service,
          charge_pb1: b.charge_pb1,
          children: b.other_invoice_items.map((a) => ({
            day: a.day.toString(),
            qty: a.qty.toString(),
            pax: a.pax,
            price: a.price.toString(),
          })),
        })),
      });

      const tersimpan = Number(t.grand_total);
      const baru = Number(hasil.grand_total);
      if (Math.abs(tersimpan - baru) > 0.01) {
        beda.push(`${t.invoice_number}: ${tersimpan} -> ${baru}`);
      }
    }

    expect(beda, "nilai invoice yang sudah ditagihkan berubah").toEqual([]);
  });

  it("quotation yang sudah terbit bernilai sama persis", async () => {
    const semua = await prisma.quotations.findMany({
      include: {
        quotation_charges: true,
        quotation_items: {
          where: { parent_id: null },
          include: { other_quotation_items: KOLOM_ANAK },
        },
      },
    });

    const beda: string[] = [];
    for (const p of semua) {
      const hasil = hitungUlang({
        nomor: p.quotation_number,
        grandTotal: p.grand_total.toString(),
        serviceChargePersen: p.service_charge_percent?.toString() ?? null,
        pb1Aktif: p.pb1_enabled,
        pb1Persen: p.pb1_percent?.toString() ?? null,
        delivery: p.delivery_amount.toString(),
        biaya: p.quotation_charges.map((c) => ({
          label: c.label,
          amount: c.amount.toString(),
        })),
        items: p.quotation_items.map((b) => ({
          day: b.day.toString(),
          qty: b.qty.toString(),
          pax: b.pax,
          price: b.price.toString(),
          is_compliment: b.is_compliment,
          charge_service: b.charge_service,
          charge_pb1: b.charge_pb1,
          children: b.other_quotation_items.map((a) => ({
            day: a.day.toString(),
            qty: a.qty.toString(),
            pax: a.pax,
            price: a.price.toString(),
          })),
        })),
      });

      const tersimpan = Number(p.grand_total);
      const baru = Number(hasil.grand_total);
      if (Math.abs(tersimpan - baru) > 0.01) {
        beda.push(`${p.quotation_number}: ${tersimpan} -> ${baru}`);
      }
    }

    expect(beda, "nilai quotation yang sudah terbit berubah").toEqual([]);
  });

  it("subtotal TIAP BARIS juga sama dengan yang tersimpan", async () => {
    // Totalnya bisa saja cocok sementara rinciannya menyimpang, dan
    // dokumen yang rinciannya tidak menjumlah ke totalnya sendiri adalah
    // dokumen yang tidak bisa dipertanggungjawabkan.
    const baris = await prisma.invoice_items.findMany({
      select: { id: true, day: true, qty: true, pax: true, price: true, subtotal: true, is_compliment: true },
      take: 500,
    });

    const beda: string[] = [];
    for (const b of baris) {
      const pax = b.pax === null || b.pax === 0 ? 1 : b.pax;
      const harusnya = b.is_compliment
        ? 0
        : Number(b.day) * Number(b.qty) * pax * Number(b.price);

      if (Math.abs(Number(b.subtotal) - harusnya) > 0.01) {
        beda.push(`baris ${b.id}: ${Number(b.subtotal)} -> ${harusnya}`);
      }
    }

    expect(beda.slice(0, 10), "subtotal baris tidak sesuai rumusnya").toEqual([]);
  });
});
