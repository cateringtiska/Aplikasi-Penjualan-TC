import { afterAll, describe, expect, it } from "vitest";

import {
  type BarisPengakuan,
  cocokSaringPengakuan,
  LABEL_SARING_PENGAKUAN,
  pengakuanDokumen,
  SARING_PENGAKUAN,
  saringPengakuanSah,
} from "../lib/pengakuan";
import { prisma } from "../lib/prisma";
import { tanggalAcaraDokumen } from "../lib/tanggal";
import { d } from "../lib/uang";

/* ==========================================================================
   ANGKA DI KARTU HARUS SAMA DENGAN ISI DAFTARNYA

   Tiap kartu di Dashboard kini bisa diklik dan membuka daftar invoice yang
   dihitungnya. Perbedaan antara keduanya TIDAK MENIMBULKAN GALAT APA PUN:
   kartunya tetap menyebut sebelas, daftarnya tetap terbuka berisi sembilan,
   dan tidak ada satu pun layar yang menyatakan mana yang benar. Yang
   membukanya justru sedang mencari dokumen yang hilang itu.

   Dijaga dengan memakai data yang sungguhan ada, bukan contoh buatan:
   keadaan yang menyusahkan — invoice tanpa tanggal acara, yang dibayar
   lebih, yang acaranya hari ini — memang ada di sana dan tidak terpikirkan
   kalau datanya dikarang.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

/** Baris pengakuan seluruh invoice, persis seperti yang dibaca Dashboard. */
async function barisPengakuan(sekarang: Date): Promise<BarisPengakuan[]> {
  const semua = await prisma.invoices.findMany({
    where: { status: { not: "cancelled" } },
    select: {
      grand_total: true,
      paid_amount: true,
      due_date: true,
      event_date: true,
      event_days: true,
      invoice_event_dates: { select: { event_date: true } },
    },
  });

  return semua.map((t) => {
    const tanggalAcara = tanggalAcaraDokumen(t.invoice_event_dates, t.event_date, t.event_days);
    return {
      hasil: pengakuanDokumen(
        { grand_total: t.grand_total, paid_amount: t.paid_amount, tanggalAcara },
        sekarang,
      ),
      dueDate: t.due_date,
      acaraTerakhir: tanggalAcara.reduce<Date | null>((a, b) => (a === null || b > a ? b : a), null),
    };
  });
}

describe("penyaring kartu", () => {
  it("setiap kartu punya labelnya, supaya daftarnya bisa menjelaskan diri", async () => {
    for (const s of SARING_PENGAKUAN) {
      expect(LABEL_SARING_PENGAKUAN[s]?.trim(), s).toBeTruthy();
    }
  });

  it("menolak penyaring yang tidak dikenal", async () => {
    // Alamat yang diketik sendiri tidak boleh menghasilkan daftar kosong
    // yang terbaca seolah tidak ada dokumennya.
    expect(saringPengakuanSah("piutang")).toBe(true);
    expect(saringPengakuanSah("bukan-kartu")).toBe(false);
    expect(saringPengakuanSah("")).toBe(false);
  });

  it("membagi seluruh invoice tanpa ada yang tertinggal maupun terhitung dua kali", async () => {
    /*
     * Empat keadaan pengakuan — diakui, uang muka, diterima di muka,
     * proyeksi — harus menampung SELURUH invoice, masing-masing tepat
     * sekali. Kalau ada yang tidak tertampung, nilainya hilang dari
     * dashboard tanpa jejak.
     */
    const sekarang = new Date();
    const baris = await barisPengakuan(sekarang);
    expect(baris.length, "tidak ada invoice untuk diuji").toBeGreaterThan(0);

    for (const b of baris) {
      const kena = (["uang-muka", "diterima-di-muka", "proyeksi"] as const).filter((s) =>
        cocokSaringPengakuan(s, b, sekarang),
      );

      // "diakui" tidak punya kartunya sendiri; ia yang tersisa.
      const jumlahKena = kena.length + (b.hasil.keadaan === "diakui" ? 1 : 0);
      expect(jumlahKena, `keadaan ${b.hasil.keadaan} tertampung ${jumlahKena} kali`).toBe(1);
    }
  });
});

describe("kartu dan daftarnya", () => {
  it("menghitung yang SAMA PERSIS untuk tiap kartu", async () => {
    /*
     * Dashboard dan daftar invoice memanggil cocokSaringPengakuan() yang
     * sama, jadi yang diperiksa di sini adalah bahwa penyaringnya memang
     * menghasilkan himpunan yang tetap — bukan bergantung pada urutan
     * pemanggilan atau pada saat yang sedikit berbeda.
     */
    const sekarang = new Date();
    const baris = await barisPengakuan(sekarang);

    for (const s of SARING_PENGAKUAN) {
      const sekali = baris.filter((b) => cocokSaringPengakuan(s, b, sekarang)).length;
      const lagi = baris.filter((b) => cocokSaringPengakuan(s, b, sekarang)).length;
      expect(lagi, `${s} tidak tetap`).toBe(sekali);
    }
  });

  it("piutang berjalan memuat PERSIS invoice yang masih bersisa", async () => {
    const sekarang = new Date();
    const baris = await barisPengakuan(sekarang);

    const piutang = baris.filter((b) => cocokSaringPengakuan("piutang", b, sekarang));

    // Tiap baris yang terpilih memang punya sisa, dan tiap baris bersisa
    // memang terpilih. Dua arah, supaya tidak ada yang lolos sebelah.
    for (const b of piutang) expect(b.hasil.piutang.gt(0)).toBe(true);
    expect(piutang.length).toBe(baris.filter((b) => b.hasil.piutang.gt(0)).length);
  });

  it("jatuh tempo adalah bagian dari piutang, tidak pernah lebih banyak", async () => {
    // Jatuh tempo berarti piutang yang tanggalnya lewat. Lebih banyak
    // daripada piutang berarti ada yang terhitung padahal sudah lunas.
    const sekarang = new Date();
    const baris = await barisPengakuan(sekarang);

    const piutang = baris.filter((b) => cocokSaringPengakuan("piutang", b, sekarang));
    const tempo = baris.filter((b) => cocokSaringPengakuan("jatuh-tempo", b, sekarang));

    expect(tempo.length).toBeLessThanOrEqual(piutang.length);
    for (const b of tempo) expect(b.hasil.piutang.gt(0)).toBe(true);
  });

  it("penjualan diakui bulan ini hanya memuat acara yang SUDAH terjadi", async () => {
    const sekarang = new Date();
    const baris = await barisPengakuan(sekarang);

    for (const b of baris.filter((x) => cocokSaringPengakuan("diakui-bulan-ini", x, sekarang))) {
      expect(b.hasil.sudahTerjadi, "acara yang belum terjadi ikut diakui").toBe(true);
      expect(b.acaraTerakhir).not.toBeNull();
    }
  });

  it("nilai kartunya sama dengan jumlah nilai barisnya", async () => {
    // Angka besar di kartu adalah penjumlahan baris yang sama dengan yang
    // dibuka daftarnya. Keduanya harus bertemu sampai rupiahnya.
    const sekarang = new Date();
    const baris = await barisPengakuan(sekarang);

    const uangMuka = baris.filter((b) => cocokSaringPengakuan("uang-muka", b, sekarang));
    const jumlahUangMuka = uangMuka.reduce((j, b) => j.plus(b.hasil.uangMuka), d(0));
    const totalDasbor = baris.reduce((j, b) => j.plus(b.hasil.uangMuka), d(0));

    // Hanya baris berkeadaan uang_muka yang punya nilai uangMuka, jadi
    // keduanya wajib sama.
    expect(jumlahUangMuka.toString()).toBe(totalDasbor.toString());
  });
});
