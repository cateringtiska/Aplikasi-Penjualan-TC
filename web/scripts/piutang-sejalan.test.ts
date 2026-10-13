import { afterAll, describe, expect, it } from "vitest";

import { ambilPiutang } from "../lib/laporan-piutang";
import { cocokSaringPengakuan, pengakuanDokumen } from "../lib/pengakuan";
import { prisma } from "../lib/prisma";
import { tanggalAcaraDokumen } from "../lib/tanggal";
import { d } from "../lib/uang";

/* ==========================================================================
   KARTU PIUTANG DAN KARTU DASHBOARD HARUS MENYEBUT ANGKA YANG SAMA

   Dua layar menghitung piutang: kartu piutang (dikelompokkan per customer)
   dan kartu "Piutang berjalan" di Dashboard, yang membuka daftar invoice.
   Keduanya memakai pengakuanDokumen() yang sama, tetapi lewat jalur yang
   berbeda — dan perbedaannya tidak akan menimbulkan galat apa pun.

   Yang terjadi hanyalah dua layar menyebut angka berbeda untuk hal yang
   sama, dan pemiliknya tidak punya cara menentukan mana yang benar. Itu
   pertanyaan yang sudah pernah diajukan.

   SATU HAL LAGI yang dijaga di sini: kartu piutang menampilkan tanggal
   invoice dan jatuh tempo TERTUA milik tiap customer, bukan tanggal satu
   dokumen. Kolomnya diberi label "Invoice tertua" dan "Tempo tertua"
   karena itu; kalau isinya suatu saat bukan yang tertua lagi, labelnya
   berbohong tanpa ada yang tahu.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

/** Invoice yang masuk kartu "Piutang berjalan" di Dashboard. */
async function piutangDashboard(sekarang: Date) {
  const semua = await prisma.invoices.findMany({
    where: { status: { not: "cancelled" } },
    select: {
      invoice_number: true,
      customer_id: true,
      grand_total: true,
      paid_amount: true,
      due_date: true,
      invoice_date: true,
      event_date: true,
      event_days: true,
      invoice_event_dates: { select: { event_date: true } },
    },
  });

  return semua
    .map((t) => {
      const tanggalAcara = tanggalAcaraDokumen(
        t.invoice_event_dates,
        t.event_date,
        t.event_days,
      );
      return {
        nomor: t.invoice_number,
        idPelanggan: t.customer_id.toString(),
        invoiceDate: t.invoice_date,
        hasil: pengakuanDokumen(
          { grand_total: t.grand_total, paid_amount: t.paid_amount, tanggalAcara },
          sekarang,
        ),
        dueDate: t.due_date,
        acaraTerakhir: tanggalAcara.reduce<Date | null>(
          (a, b) => (a === null || b > a ? b : a),
          null,
        ),
      };
    })
    .filter((b) => cocokSaringPengakuan("piutang", b, sekarang));
}

describe("kedua layar sejalan", () => {
  it("menghitung JUMLAH INVOICE yang sama", async () => {
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);
    const kartu = await ambilPiutang("", {});

    const lembarKartu = kartu.daftar.reduce((j, p) => j + p.jumlahTagihan, 0);

    expect(lembarKartu, "kartu piutang dan kartu Dashboard tidak sejalan").toBe(
      dashboard.length,
    );
  });

  it("menghitung TOTAL yang sama sampai rupiahnya", async () => {
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);
    const kartu = await ambilPiutang("", {});

    const totalDashboard = dashboard.reduce((j, b) => j.plus(b.hasil.piutang), d(0));
    expect(kartu.totalSemua.toString()).toBe(totalDashboard.toString());
  });

  it("membagi ke customer yang sama, dengan jumlah lembar yang sama", async () => {
    // Totalnya bisa saja cocok sementara pembagiannya menyimpang, dan yang
    // dipakai menagih adalah pembagian per customernya.
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);

    const perPelanggan = new Map<string, number>();
    for (const b of dashboard) {
      perPelanggan.set(b.idPelanggan, (perPelanggan.get(b.idPelanggan) ?? 0) + 1);
    }

    const kartu = await ambilPiutang("", {});

    expect(kartu.daftar.length, "banyaknya customer berbeda").toBe(perPelanggan.size);

    for (const p of kartu.daftar) {
      expect(p.jumlahTagihan, `lembar ${p.nama}`).toBe(perPelanggan.get(p.idPelanggan));
    }
  });
});

describe("tanggal pada kartu piutang", () => {
  it("adalah yang TERTUA di antara invoice customer itu", async () => {
    /*
     * Kolomnya berlabel "Invoice tertua" dan "Tempo tertua". Kalau isinya
     * bukan yang tertua, labelnya berbohong — dan Telkomsat yang merangkum
     * lima invoice akan terbaca seolah punya satu invoice bertanggal lain
     * daripada yang ada di daftar invoicenya.
     */
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);
    const kartu = await ambilPiutang("", {});

    expect(kartu.daftar.length, "tidak ada piutang untuk diuji").toBeGreaterThan(0);

    for (const p of kartu.daftar) {
      const miliknya = dashboard.filter((b) => b.idPelanggan === p.idPelanggan);
      expect(miliknya.length, `invoice ${p.nama}`).toBeGreaterThan(0);

      const invoiceTertua = miliknya
        .map((b) => b.invoiceDate.getTime())
        .reduce((a, b) => Math.min(a, b));
      const tempoTertua = miliknya
        .map((b) => b.dueDate.getTime())
        .reduce((a, b) => Math.min(a, b));

      expect(p.tanggalTertua.getTime(), `tanggal invoice tertua ${p.nama}`).toBe(invoiceTertua);
      expect(p.tempoTertua.getTime(), `jatuh tempo tertua ${p.nama}`).toBe(tempoTertua);
    }
  });
});
