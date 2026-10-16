import { beforeEach, describe, expect, it, vi } from "vitest";

/* ==========================================================================
   PEMBATALAN TANPA ALASAN HARUS GAGAL SEBELUM MENYENTUH APA PUN

   Yang dijaga di sini bukan "alasannya ditolak" — itu sudah diuji sebagai
   aturan di lib/pembatalan.test.ts. Yang dijaga adalah URUTANNYA.

   Memeriksa alasannya SESUDAH status diubah akan membatalkan dokumennya
   lalu gagal menyimpan alasannya. Yang tertinggal adalah invoice yang
   berstatus dibatalkan tanpa keterangan apa pun — persis keadaan yang
   hendak dihindari, dan sekarang tanpa cara memperbaikinya karena dokumen
   yang sudah dibatalkan tidak bisa diubah lagi.

   Pemakainya pun melihat pesan galat dan mengira tidak terjadi apa-apa.
   ========================================================================== */

const ubahTagihan = vi.fn();
const cariTagihan = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoices: {
      findUnique: (...a: unknown[]) => cariTagihan(...a),
      update: (...a: unknown[]) => ubahTagihan(...a),
    },
  },
}));

vi.mock("@/lib/rbac", () => ({
  pastikanIzin: async () => ({ id: "1", nama: "Reza", username: "reza", email: null, peran: "admin" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { batalkanTagihan } from "./actions";

beforeEach(() => {
  cariTagihan.mockReset();
  ubahTagihan.mockReset();
  cariTagihan.mockResolvedValue({ paid_amount: "0", status: "unpaid" });
  ubahTagihan.mockResolvedValue({});
});

describe("alasan yang tidak sah", () => {
  it("TIDAK menulis apa pun ketika alasannya kosong", async () => {
    await expect(batalkanTagihan("7", "")).rejects.toThrow(/belum diisi/i);
    expect(ubahTagihan, "invoice telanjur dibatalkan").not.toHaveBeenCalled();
  });

  it("TIDAK menulis apa pun ketika alasannya hanya spasi", async () => {
    await expect(batalkanTagihan("7", "    ")).rejects.toThrow();
    expect(ubahTagihan).not.toHaveBeenCalled();
  });

  it("TIDAK menulis apa pun ketika alasannya terlalu pendek", async () => {
    await expect(batalkanTagihan("7", "x")).rejects.toThrow(/pendek/i);
    expect(ubahTagihan).not.toHaveBeenCalled();
  });

  it("diperiksa SEBELUM invoicenya dibaca sama sekali", async () => {
    // Urutannya menentukan. Membaca dulu lalu memeriksa alasannya masih
    // aman, tetapi memeriksa alasannya paling awal membuat seluruh jalur
    // sesudahnya tidak mungkin berjalan setengah.
    await expect(batalkanTagihan("7", "")).rejects.toThrow();
    expect(cariTagihan).not.toHaveBeenCalled();
  });
});

describe("alasan yang sah", () => {
  it("menyimpan alasannya beserta waktu dan siapa yang membatalkan", async () => {
    await batalkanTagihan("7", "  Customer   membatalkan acaranya  ");

    expect(ubahTagihan).toHaveBeenCalledTimes(1);
    const data = ubahTagihan.mock.calls[0][0].data;

    expect(data.status).toBe("cancelled");
    // Sudah dirapikan: spasi beruntun disatukan, ujungnya dibuang.
    expect(data.cancel_reason).toBe("Customer membatalkan acaranya");
    expect(data.cancelled_at).toBeInstanceOf(Date);
    expect(data.cancelled_by).toBe(BigInt(1));
  });

  it("TETAP menolak invoice yang sudah menerima payment", async () => {
    // Alasan yang sah tidak boleh menjadi jalan pintas melewati penjagaan
    // yang sudah ada.
    cariTagihan.mockResolvedValue({ paid_amount: "500000", status: "partial" });

    await expect(batalkanTagihan("7", "Customer membatalkan acaranya")).rejects.toThrow(
      /payment/i,
    );
    expect(ubahTagihan).not.toHaveBeenCalled();
  });
});
