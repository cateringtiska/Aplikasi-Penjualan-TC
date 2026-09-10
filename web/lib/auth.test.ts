// @vitest-environment node
//
// Bukan jsdom: di sana Uint8Array berasal dari realm yang berbeda, sehingga
// pemeriksaan instanceof di dalam jose gagal padahal nilainya benar.

import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ==========================================================================
   PENJAGA AKSES MEMBACA KEADAAN TERKINI

   Cookie sesi adalah SALINAN data pengguna pada saat login, dan salinan itu
   tidak berubah sendiri sampai kedaluwarsa — 8 jam. Kalau hak akses dibaca
   dari sana, tiga hal jadi salah selama itu:

     - Pengguna yang dinonaktifkan tetap bisa membuka semua halaman.
     - Pengguna yang perannya diturunkan tetap memegang akses lamanya.
     - Nama dan email di sidebar tetap yang lama setelah diubah.

   Yang ketiga yang ketahuan lebih dulu oleh pemakainya, tetapi dua yang
   pertama yang berbahaya. Tes ini mengunci perilaku yang benar: penggunaAktif()
   membaca ULANG dari database, dan cookie hanya dipakai untuk mengetahui
   pengguna mana yang sedang masuk.
   ========================================================================== */

const RAHASIA = "rahasia-untuk-tes-saja-yang-cukup-panjang";

const cariPengguna = vi.fn();
const ambilCookie = vi.fn();

vi.mock("./prisma", () => ({
  prisma: { users: { findUnique: (...a: unknown[]) => cariPengguna(...a) } },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nama: string) => ambilCookie(nama) }),
}));

async function pasangCookie(isi: Record<string, unknown>) {
  const token = await new SignJWT(isi)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(RAHASIA));

  ambilCookie.mockReturnValue({ value: token });
}

beforeEach(() => {
  vi.resetModules();
  process.env.AUTH_SECRET = RAHASIA;
  cariPengguna.mockReset();
  ambilCookie.mockReset();
});

async function muat() {
  return import("./auth");
}

describe("penggunaAktif", () => {
  it("mengembalikan data TERBARU dari database, bukan isi cookie", async () => {
    // Cookie dibuat saat email lama masih dipakai.
    await pasangCookie({
      id: "1",
      nama: "Nama Lama",
      email: "lama@contoh.com",
      peran: "sales",
    });

    // Sementara di database namanya, emailnya, dan perannya sudah berubah.
    cariPengguna.mockResolvedValue({
      id: BigInt(1),
      name: "Nama Baru",
      email: "baru@contoh.com",
      role: "admin",
      is_active: true,
    });

    const { penggunaAktif } = await muat();
    const sesi = await penggunaAktif();

    expect(sesi).toEqual({
      id: "1",
      nama: "Nama Baru",
      email: "baru@contoh.com",
      peran: "admin",
    });
  });

  it("menolak pengguna yang sudah dinonaktifkan walau cookienya masih sah", async () => {
    await pasangCookie({ id: "2", nama: "Budi", email: "budi@contoh.com", peran: "sales" });
    cariPengguna.mockResolvedValue({
      id: BigInt(2),
      name: "Budi",
      email: "budi@contoh.com",
      role: "sales",
      is_active: false,
    });

    const { penggunaAktif } = await muat();
    expect(await penggunaAktif()).toBeNull();
  });

  it("menolak pengguna yang akunnya sudah dihapus", async () => {
    await pasangCookie({ id: "9", nama: "Hilang", email: "hilang@contoh.com", peran: "admin" });
    cariPengguna.mockResolvedValue(null);

    const { penggunaAktif } = await muat();
    expect(await penggunaAktif()).toBeNull();
  });

  it("menolak ketika tidak ada cookie sama sekali", async () => {
    ambilCookie.mockReturnValue(undefined);

    const { penggunaAktif } = await muat();
    expect(await penggunaAktif()).toBeNull();
    expect(cariPengguna).not.toHaveBeenCalled();
  });

  it("menolak cookie yang tanda tangannya tidak cocok", async () => {
    const token = await new SignJWT({ id: "1", nama: "X", email: "x@x.com", peran: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("kunci-yang-berbeda-sama-sekali-panjang"));
    ambilCookie.mockReturnValue({ value: token });

    const { penggunaAktif } = await muat();
    expect(await penggunaAktif()).toBeNull();
    expect(cariPengguna).not.toHaveBeenCalled();
  });
});

describe("cocokkanSandi", () => {
  it("menerima hash $2y$ buatan Laravel", async () => {
    const { buatHashSandi, cocokkanSandi } = await muat();

    const hash = await buatHashSandi("sandi-rahasia");
    expect(hash.startsWith("$2y$")).toBe(true);
    expect(await cocokkanSandi("sandi-rahasia", hash)).toBe(true);
    expect(await cocokkanSandi("sandi-salah", hash)).toBe(false);
  });
});
