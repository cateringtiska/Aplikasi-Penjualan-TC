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

  it("menyetujui langsung pada quotation terkirim", async () => {
    pasang("sent");

    await userEvent.click(screen.getByRole("button", { name: /tandai disetujui/i }));
    expect(ubahStatus).toHaveBeenCalledWith("7", "approved");
  });

  it("MENANYAKAN ALASAN dulu sebelum menolak, tidak langsung menolak", async () => {
    /*
     * Dulu tombol ini langsung mengubah statusnya. Penolakan tanpa
     * keterangan menghasilkan dokumen yang beberapa minggu kemudian tidak
     * bisa dijelaskan siapa pun — dan yang bertanya biasanya customer itu
     * sendiri, atau akuntan saat menutup bulan.
     */
    pasang("sent");

    await userEvent.click(screen.getByRole("button", { name: /ditolak/i }));

    expect(ubahStatus, "quotation ditolak tanpa menanyakan alasannya").not.toHaveBeenCalled();
    expect(screen.getByLabelText(/alasan pembatalan/i)).toBeTruthy();
  });

  it("menolak setelah alasannya diisi, dan mengirimkan alasannya", async () => {
    pasang("sent");

    await userEvent.click(screen.getByRole("button", { name: /ditolak/i }));
    await userEvent.type(
      screen.getByLabelText(/alasan pembatalan/i),
      "Customer memilih vendor lain",
    );
    await userEvent.click(screen.getByRole("button", { name: /tandai ditolak/i }));

    expect(ubahStatus).toHaveBeenCalledWith("7", "rejected", "Customer memilih vendor lain");
  });

  it("TIDAK menolak ketika alasannya dibiarkan kosong", async () => {
    // Pemeriksaan di layar hanya kenyamanan — server memeriksanya lagi —
    // tetapi tanpa ini pemakainya menekan tombol lalu melihat galat yang
    // tidak ia mengerti asalnya.
    pasang("sent");

    await userEvent.click(screen.getByRole("button", { name: /ditolak/i }));
    await userEvent.click(screen.getByRole("button", { name: /tandai ditolak/i }));

    expect(ubahStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/belum diisi/i);
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
