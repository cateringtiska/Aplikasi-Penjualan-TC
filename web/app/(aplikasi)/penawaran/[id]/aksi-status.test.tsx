import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ==========================================================================
   TOMBOL LANGKAH BERIKUTNYA HARUS BENAR-BENAR TERPANGGIL

   Tiga bug beruntun di aplikasi ini pernah berupa tombol yang tampil rapi
   tetapi penanganannya tidak pernah berjalan: TypeScript bersih, build
   bersih, log server kosong, dan pengguna menyimpulkan fiturnya belum ada.
   Menggambar komponennya saja tidak cukup — tombolnya harus DIKLIK.

   Yang dikunci di sini sekaligus urutan statusnya: draft menuju terkirim,
   terkirim menuju disetujui. Kalau urutan itu berubah diam-diam, jalan menuju
   "Buat invoice" ikut berubah, dan itu justru yang sedang dicari orang.
   ========================================================================== */

const ubahStatus = vi.fn();

vi.mock("../actions", () => ({
  ubahStatusPenawaran: (...a: unknown[]) => ubahStatus(...a),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { AksiStatusPenawaran } from "./aksi-status";

beforeEach(() => {
  ubahStatus.mockReset();
  ubahStatus.mockResolvedValue(undefined);
});

function pasang(status: string) {
  render(<AksiStatusPenawaran id="7" nomor="QUO-2026-0001" status={status} />);
}

describe("AksiStatusPenawaran", () => {
  it("menawarkan 'Tandai terkirim' pada quotation draft, dan kliknya benar-benar bekerja", async () => {
    pasang("draft");

    const tombol = screen.getByRole("button", { name: /tandai terkirim/i });
    await userEvent.click(tombol);

    expect(ubahStatus).toHaveBeenCalledWith("7", "sent");
  });

  it("menawarkan disetujui dan ditolak pada quotation terkirim", async () => {
    pasang("sent");

    await userEvent.click(screen.getByRole("button", { name: /tandai disetujui/i }));
    expect(ubahStatus).toHaveBeenCalledWith("7", "approved");

    await userEvent.click(screen.getByRole("button", { name: /ditolak/i }));
    expect(ubahStatus).toHaveBeenCalledWith("7", "rejected");
  });

  it("menawarkan kirim ulang pada quotation yang ditolak atau kadaluarsa", async () => {
    pasang("rejected");
    await userEvent.click(screen.getByRole("button", { name: /kirim ulang/i }));
    expect(ubahStatus).toHaveBeenCalledWith("7", "sent");
  });

  it("tidak menawarkan apa pun setelah disetujui", () => {
    pasang("approved");

    // Langkah berikutnya bukan status lagi, melainkan "Buat invoice" yang
    // dirender halaman. Satu tombol status yang tersisa di sini akan
    // membingungkan: statusnya sudah tidak bisa maju ke mana pun.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
