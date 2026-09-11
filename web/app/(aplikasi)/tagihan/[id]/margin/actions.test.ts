import { beforeEach, describe, expect, it, vi } from "vitest";

/* ==========================================================================
   MARGIN TIDAK BOLEH DIKUNCI SELAGI KOSONG

   Tagihan tanpa satu pun catatan biaya selalu terbaca untung 100%. Angka itu
   hampir pasti keliru — katering selalu punya biaya — dan begitu margin
   difinalisasi, biayanya justru TIDAK BISA lagi dimasukkan: simpanBiaya
   menolak setiap perubahan pada margin yang berstatus final.

   Jadi menekan Finalisasi pada tagihan yang belum berbiaya akan mengunci
   laporan pada angka yang salah, dan jalan keluarnya hanya lewat "Buka
   kembali" — yang tidak jelas terlihat ketika orangnya belum tahu apa yang
   barusan terjadi. Tombol itu duduk tepat di atas formulir biaya, hanya
   beberapa sentimeter dari tombol "Tambah biaya".
   ========================================================================== */

const hitungBiaya = vi.fn();
const ubahMargin = vi.fn();
const upsertMargin = vi.fn();
const cariTagihan = vi.fn();
const cariBiaya = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice_costs: {
      count: (...a: unknown[]) => hitungBiaya(...a),
      findMany: (...a: unknown[]) => cariBiaya(...a),
    },
    invoice_margins: {
      update: (...a: unknown[]) => ubahMargin(...a),
      upsert: (...a: unknown[]) => upsertMargin(...a),
    },
    invoices: { findUniqueOrThrow: (...a: unknown[]) => cariTagihan(...a) },
  },
}));

vi.mock("@/lib/rbac", () => ({
  pastikanPeran: async () => ({ id: "1", nama: "Reza", username: "reza", email: null, peran: "admin" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

beforeEach(() => {
  vi.resetModules();
  hitungBiaya.mockReset();
  ubahMargin.mockReset();
  upsertMargin.mockReset();
  cariTagihan.mockReset();
  cariBiaya.mockReset();
  cariTagihan.mockResolvedValue({ subtotal: "1000000" });
  cariBiaya.mockResolvedValue([]);
  upsertMargin.mockResolvedValue({});
  ubahMargin.mockResolvedValue({});
});

describe("finalisasiMargin", () => {
  it("menolak tagihan yang belum punya satu pun baris biaya", async () => {
    hitungBiaya.mockResolvedValue(0);

    const { finalisasiMargin } = await import("./actions");

    await expect(finalisasiMargin("7")).rejects.toThrow(/[Bb]elum ada biaya/);

    // Yang terpenting: tidak ada apa pun yang tertulis. Kalau penjaga ini
    // hanya melempar galat SETELAH menulis, marginnya tetap terkunci.
    expect(ubahMargin).not.toHaveBeenCalled();
    expect(upsertMargin).not.toHaveBeenCalled();
  });

  it("menyebut cara keluarnya, bukan sekadar menolak", async () => {
    hitungBiaya.mockResolvedValue(0);

    const { finalisasiMargin } = await import("./actions");

    await expect(finalisasiMargin("7")).rejects.toThrow(/Tambah biaya/);
  });

  it("meneruskan finalisasi begitu ada biaya yang dicatat", async () => {
    hitungBiaya.mockResolvedValue(1);
    cariBiaya.mockResolvedValue([{ estimated_amount: "500000", actual_amount: null }]);

    const { finalisasiMargin } = await import("./actions");
    await finalisasiMargin("7");

    expect(upsertMargin).toHaveBeenCalled();
    expect(ubahMargin).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "final", finalized_by: BigInt(1) }),
      }),
    );
  });
});
