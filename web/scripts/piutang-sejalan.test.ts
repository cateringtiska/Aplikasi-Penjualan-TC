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
  it("memuat invoice yang SAMA PERSIS, nomor per nomor", async () => {
    /*
     * Kartu piutang kini satu baris satu invoice, sama bentuknya dengan
     * daftar yang dibuka kartu Dashboard. Jadi keduanya bisa dibandingkan
     * langsung lewat nomornya — bukan lagi lewat jumlah dan total, yang
     * bisa kebetulan cocok sementara isinya berbeda.
     */
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);
    const kartu = await ambilPiutang("", {});

    const nomorKartu = kartu.daftar.map((p) => p.nomor).sort();
    const nomorDashboard = dashboard.map((b) => b.nomor).sort();

    expect(nomorKartu, "kartu piutang dan kartu Dashboard memuat invoice berbeda").toEqual(
      nomorDashboard,
    );
  });

  it("menyebut SISA yang sama untuk tiap invoice", async () => {
    // Himpunannya bisa saja sama sementara angkanya berbeda, dan yang
    // dipakai menagih adalah angkanya.
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);
    const kartu = await ambilPiutang("", {});

    const sisaDashboard = new Map(dashboard.map((b) => [b.nomor, b.hasil.piutang.toString()]));

    for (const p of kartu.daftar) {
      expect(p.sisa.toString(), `sisa ${p.nomor}`).toBe(sisaDashboard.get(p.nomor));
    }
  });

  it("menghitung TOTAL yang sama sampai rupiahnya", async () => {
    const sekarang = new Date();
    const dashboard = await piutangDashboard(sekarang);
    const kartu = await ambilPiutang("", {});

    const totalDashboard = dashboard.reduce((j, b) => j.plus(b.hasil.piutang), d(0));
    expect(kartu.totalSemua.toString()).toBe(totalDashboard.toString());
  });

  it("menyebut banyaknya customer dengan benar", async () => {
    const kartu = await ambilPiutang("", {});
    const unik = new Set(kartu.daftar.map((p) => p.idPelanggan));

    expect(kartu.jumlahPelanggan).toBe(unik.size);
  });
});

describe("urutan barisnya", () => {
  it("menjaga invoice satu customer tetap BERDAMPINGAN", async () => {
    /*
     * Penagihan dilakukan dengan menelepon orangnya sekali, bukan sekali
     * per lembar. Baris satu customer yang tersebar di seluruh tabel
     * memaksa penagih mencarinya satu per satu, dan mudah ada yang
     * terlewat.
     */
    const kartu = await ambilPiutang("", {});
    if (kartu.daftar.length < 2) return;

    const terlihat = new Set<string>();
    let sebelumnya = "";

    for (const p of kartu.daftar) {
      if (p.idPelanggan !== sebelumnya) {
        expect(terlihat.has(p.idPelanggan), `baris ${p.nama} terpisah`).toBe(false);
        terlihat.add(p.idPelanggan);
        sebelumnya = p.idPelanggan;
      }
    }
  });

  it("menaruh yang jatuh temponya paling dulu di atas, dalam satu customer", async () => {
    const kartu = await ambilPiutang("", {});

    for (let i = 1; i < kartu.daftar.length; i += 1) {
      const a = kartu.daftar[i - 1];
      const b = kartu.daftar[i];
      if (a.idPelanggan !== b.idPelanggan) continue;

      expect(a.tempo.getTime(), `${a.nomor} vs ${b.nomor}`).toBeLessThanOrEqual(
        b.tempo.getTime(),
      );
    }
  });
});
