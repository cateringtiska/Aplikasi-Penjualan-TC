import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KerangkaAplikasi } from "./kerangka-aplikasi";

/* ==========================================================================
   TES MEMBUKA MENU

   Tiga bug beruntun pernah lolos ke produksi lewat komponen ini, dan
   ketiganya punya sifat yang sama: TypeScript bersih, build bersih, log
   server kosong, dan baru gagal ketika ada yang mengkliknya.

     1. onSelect dipakai padahal Base UI memanggil onClick — tombolnya diam.
     2. Server action dipanggil di luar transition — galat di browser.
     3. DropdownMenuLabel dipakai di luar Menu.Group — Base UI melempar galat
        saat menu dibuka, menjatuhkan seluruh halaman.

   Tes ini benar-benar MEMBUKA menunya, bukan sekadar menggambar halaman.
   Yang nomor 3 hanya bisa tertangkap dengan cara itu, karena isi menu tidak
   dirender sama sekali sebelum dibuka.
   ========================================================================== */

vi.mock("next/navigation", () => ({
  usePathname: () => "/dasbor",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

const sesi = {
  id: "1",
  nama: "Reza Devyan",
  email: "reza@contoh.com",
  peran: "admin" as const,
};

function gambar(onKeluar = vi.fn(async () => {})) {
  render(
    <KerangkaAplikasi sesi={sesi} onKeluar={onKeluar}>
      <p>isi halaman</p>
    </KerangkaAplikasi>,
  );
  return onKeluar;
}

describe("Kerangka aplikasi", () => {
  it("menggambar navigasi sesuai peran", () => {
    gambar();

    // Admin melihat semuanya, termasuk yang khusus finance dan admin.
    for (const label of ["Dasbor", "Penawaran", "Tagihan", "Pembayaran", "Pengguna"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }
  });

  it("membuka menu kartu pengguna tanpa menjatuhkan halaman", async () => {
    const pengguna = userEvent.setup();
    gambar();

    // Isi menu belum ada sebelum dibuka — inilah kenapa menggambar halaman
    // saja tidak pernah menangkap galat di dalamnya.
    expect(screen.queryByRole("menuitem", { name: /Keluar/ })).toBeNull();

    const pemicu = screen.getAllByRole("button", { name: /Reza Devyan/ })[0];
    await pengguna.click(pemicu);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Keluar/ })).toBeTruthy();
    });

    // Identitas ikut tampil di dalam menu.
    expect(screen.getAllByText("reza@contoh.com").length).toBeGreaterThan(0);
  });

  it("memanggil aksi keluar ketika Keluar ditekan", async () => {
    const pengguna = userEvent.setup();
    const onKeluar = gambar();

    await pengguna.click(screen.getAllByRole("button", { name: /Reza Devyan/ })[0]);

    const tombolKeluar = await screen.findByRole("menuitem", { name: /Keluar/ });
    await pengguna.click(tombolKeluar);

    // Kalau server action dipanggil di luar transition, klik ini melempar
    // galat dan onKeluar tidak pernah sampai dipanggil.
    await waitFor(() => {
      expect(onKeluar).toHaveBeenCalledTimes(1);
    });
  });
});
