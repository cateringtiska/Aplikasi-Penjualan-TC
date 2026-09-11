// @vitest-environment node
//
// Bukan jsdom: di sana Uint8Array berasal dari realm yang berbeda, sehingga
// pemeriksaan instanceof di dalam jose gagal padahal nilainya benar.

import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ==========================================================================
   MASUK DAN PENJAGA AKSES

   Dua hal yang dikunci di sini:

   1. Masuk memakai NAMA PENGGUNA, dan salah sandi berulang mengunci akun
      sementara. Penguncian itulah yang membuat PIN pendek masuk akal —
      PIN enam angka hanya sejuta kemungkinan, dan tanpa penguncian, mesin
      menebaknya sampai tembus dalam hitungan menit.

   2. Hak akses dibaca ULANG dari database, bukan dari cookie. Cookie hanya
      salinan pada saat login; tanpa pembacaan ulang, pengguna yang
      dinonaktifkan atau diturunkan perannya tetap memegang akses lamanya
      sampai sesinya kedaluwarsa — 8 jam.
   ========================================================================== */

const RAHASIA = "rahasia-untuk-tes-saja-yang-cukup-panjang";

const cariPengguna = vi.fn();
const ubahPengguna = vi.fn();
const ambilCookie = vi.fn();
const pasangCookieKe = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    users: {
      findUnique: (...a: unknown[]) => cariPengguna(...a),
      update: (...a: unknown[]) => ubahPengguna(...a),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nama: string) => ambilCookie(nama),
    set: (...a: unknown[]) => pasangCookieKe(...a),
    delete: () => {},
  }),
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
  ubahPengguna.mockReset();
  ambilCookie.mockReset();
  pasangCookieKe.mockReset();
  ubahPengguna.mockResolvedValue({});
});

async function muat() {
  return import("./auth");
}

/** Baris pengguna lengkap dengan sandi yang sudah di-hash. */
async function baris(ubahan: Record<string, unknown> = {}) {
  const { buatHashSandi } = await muat();
  return {
    id: BigInt(1),
    name: "Budi Santoso",
    username: "budi",
    email: null,
    password: await buatHashSandi("246810"),
    role: "sales",
    is_active: true,
    gagal_masuk: 0,
    terkunci_sampai: null,
    ...ubahan,
  };
}

describe("masuk", () => {
  it("menerima PIN enam angka dan mengembalikan sesi", async () => {
    cariPengguna.mockResolvedValue(await baris());

    const { masuk } = await muat();
    const hasil = await masuk("budi", "246810");

    expect(hasil.berhasil).toBe(true);
    if (hasil.berhasil) {
      expect(hasil.sesi.username).toBe("budi");
      expect(hasil.sesi.peran).toBe("sales");
      expect(hasil.sesi.email).toBeNull();
    }
    expect(pasangCookieKe).toHaveBeenCalled();
  });

  it("mencari nama user tanpa peduli huruf besar-kecil", async () => {
    cariPengguna.mockResolvedValue(await baris());

    const { masuk } = await muat();
    await masuk("  BuDi  ", "246810");

    expect(cariPengguna).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: "budi" } }),
    );
  });

  it("memberi pesan yang sama untuk nama tidak ada maupun sandi salah", async () => {
    const { masuk } = await muat();

    cariPengguna.mockResolvedValue(null);
    const tidakAda = await masuk("hantu", "246810");

    cariPengguna.mockResolvedValue(await baris());
    const sandiSalah = await masuk("budi", "salah-sekali");

    // Keduanya harus diawali kalimat yang sama, supaya halaman masuk tidak
    // bisa dipakai menebak siapa saja yang terdaftar.
    const awalan = "Nama user atau kata sandi salah.";
    expect(tidakAda.berhasil).toBe(false);
    expect(sandiSalah.berhasil).toBe(false);
    if (!tidakAda.berhasil) expect(tidakAda.pesan.startsWith(awalan)).toBe(true);
    if (!sandiSalah.berhasil) expect(sandiSalah.pesan.startsWith(awalan)).toBe(true);
  });

  it("menghitung percobaan gagal dan memberi tahu sisanya", async () => {
    cariPengguna.mockResolvedValue(await baris({ gagal_masuk: 2 }));

    const { masuk } = await muat();
    const hasil = await masuk("budi", "salah");

    expect(hasil.berhasil).toBe(false);
    if (!hasil.berhasil) expect(hasil.pesan).toContain("Sisa 2 percobaan");
    expect(ubahPengguna).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gagal_masuk: 3 }) }),
    );
  });

  it("mengunci akun pada percobaan gagal kelima", async () => {
    cariPengguna.mockResolvedValue(await baris({ gagal_masuk: 4 }));

    const { masuk } = await muat();
    const hasil = await masuk("budi", "salah");

    expect(hasil.berhasil).toBe(false);
    if (!hasil.berhasil) expect(hasil.pesan).toContain("dikunci 15 menit");

    const data = ubahPengguna.mock.calls[0][0].data;
    expect(data.gagal_masuk).toBe(0);
    expect(data.terkunci_sampai).toBeInstanceOf(Date);
    expect(data.terkunci_sampai.getTime()).toBeGreaterThan(Date.now());
  });

  it("menolak masuk selagi terkunci, walau sandinya benar", async () => {
    const nanti = new Date(Date.now() + 10 * 60_000);
    cariPengguna.mockResolvedValue(await baris({ terkunci_sampai: nanti }));

    const { masuk } = await muat();
    const hasil = await masuk("budi", "246810");

    expect(hasil.berhasil).toBe(false);
    if (!hasil.berhasil) expect(hasil.pesan).toContain("Coba lagi dalam");
    // Tidak menambah hitungan gagal: sandinya tidak pernah sempat diperiksa.
    expect(ubahPengguna).not.toHaveBeenCalled();
  });

  it("kembali menerima sandi setelah masa kunci lewat", async () => {
    const tadi = new Date(Date.now() - 60_000);
    cariPengguna.mockResolvedValue(await baris({ terkunci_sampai: tadi, gagal_masuk: 4 }));

    const { masuk } = await muat();
    const hasil = await masuk("budi", "246810");

    expect(hasil.berhasil).toBe(true);
    // Hitungan gagal dikosongkan supaya salah ketik kemarin tidak menumpuk.
    expect(ubahPengguna).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { gagal_masuk: 0, terkunci_sampai: null },
      }),
    );
  });

  it("menolak akun yang dinonaktifkan meski sandinya benar", async () => {
    cariPengguna.mockResolvedValue(await baris({ is_active: false }));

    const { masuk } = await muat();
    const hasil = await masuk("budi", "246810");

    expect(hasil.berhasil).toBe(false);
    if (!hasil.berhasil) expect(hasil.pesan).toContain("dinonaktifkan");
  });
});

describe("penggunaAktif", () => {
  it("mengembalikan data TERBARU dari database, bukan isi cookie", async () => {
    await pasangCookie({
      id: "1",
      nama: "Nama Lama",
      username: "lama",
      email: "lama@contoh.com",
      peran: "sales",
    });

    cariPengguna.mockResolvedValue({
      id: BigInt(1),
      name: "Nama Baru",
      username: "baru",
      email: null,
      role: "admin",
      is_active: true,
    });

    const { penggunaAktif } = await muat();

    expect(await penggunaAktif()).toEqual({
      id: "1",
      nama: "Nama Baru",
      username: "baru",
      email: null,
      peran: "admin",
    });
  });

  it("menolak user yang sudah dinonaktifkan walau cookienya masih sah", async () => {
    await pasangCookie({ id: "2", nama: "Budi", username: "budi", peran: "sales" });
    cariPengguna.mockResolvedValue({
      id: BigInt(2),
      name: "Budi",
      username: "budi",
      email: null,
      role: "sales",
      is_active: false,
    });

    const { penggunaAktif } = await muat();
    expect(await penggunaAktif()).toBeNull();
  });

  it("menolak user yang akunnya sudah dihapus", async () => {
    await pasangCookie({ id: "9", nama: "Hilang", username: "hilang", peran: "admin" });
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
    const token = await new SignJWT({ id: "1", nama: "X", username: "x", peran: "admin" })
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
