import { afterAll, describe, expect, it } from "vitest";

import { MENU, PERAN_DIATUR } from "../lib/navigasi";
import { PERAN } from "../lib/peran";
import { prisma } from "../lib/prisma";
import { hanyaMiliknya } from "../lib/rbac";

/* ==========================================================================
   PERAN BARU HARUS IKUT ADA DI DATABASE

   Menambah peran di lib/peran.ts tidak menimbulkan satu pun galat kompilasi
   di sisi database. Dua hal ikut tertinggal, dan keduanya hanya terasa jauh
   setelahnya:

   1. BATASAN users_role_check. Layar User tetap menampilkan pilihannya dan
      tetap menerima kirimannya; kegagalannya baru muncul pada saat seseorang
      benar-benar diberi peran itu, sebagai galat database mentah.

   2. BARIS role_permissions. Tanpa barisnya, aplikasinya tetap jalan memakai
      aturan bawaan — tetapi tabel hak akses di layar User menggambar
      centangnya dari tabel itu, jadi admin melihat keadaan yang bukan
      keadaan sebenarnya.

   Tesnya ditulis atas PERAN dan PERAN_DIATUR, bukan atas nama "cost": peran
   berikutnya akan ikut terperiksa tanpa ada yang perlu ingat.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

describe("batasan peran di tabel users", () => {
  it("MENERIMA setiap peran yang dikenal kode", async () => {
    const ditolak: string[] = [];

    for (const peran of PERAN) {
      // Dicoba sungguhan, lalu dibatalkan. Membaca definisi batasannya
      // sebagai teks hanya memeriksa tulisannya, bukan perilakunya.
      try {
        await prisma.$transaction(async (tx) => {
          const cap = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
          await tx.users.create({
            data: {
              name: "UJI BATASAN PERAN",
              username: `ujiperan${cap}`,
              email: `ujiperan${cap}@contoh.invalid`,
              password: "x".repeat(60),
              role: peran,
              is_active: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });
          throw new Error("BATALKAN");
        });
      } catch (galat) {
        if (!(galat instanceof Error) || galat.message !== "BATALKAN") ditolak.push(peran);
      }
    }

    expect(
      ditolak,
      "peran ini ada di kode tetapi ditolak database — orangnya tidak akan bisa disimpan",
    ).toEqual([]);
  });

  it("tetap MENOLAK peran yang tidak dikenal", async () => {
    // Batasan yang dilebarkan dengan cara yang salah bisa berubah menjadi
    // menerima apa saja, dan itu tidak terlihat dari layar mana pun.
    let lolos = false;

    try {
      await prisma.$transaction(async (tx) => {
        const cap = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
        await tx.users.create({
          data: {
            name: "UJI BATASAN PERAN",
            username: `ujiasing${cap}`,
            email: `ujiasing${cap}@contoh.invalid`,
            password: "x".repeat(60),
            role: "gudang",
            is_active: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        lolos = true;
        throw new Error("BATALKAN");
      });
    } catch {
      /* Ditolak memang yang diharapkan. */
    }

    expect(lolos, "peran asing diterima database").toBe(false);
  });

  it("tidak meninggalkan satu pun baris uji", async () => {
    const sisa = await prisma.users.count({ where: { name: "UJI BATASAN PERAN" } });
    expect(sisa).toBe(0);
  });
});

describe("baris hak akses", () => {
  it("lengkap untuk setiap peran yang diatur", async () => {
    const seharusnya = MENU.flatMap((k) => k.butir)
      .filter((b) => !b.hanyaAdmin)
      .map((b) => b.kunci);

    const tersimpan = await prisma.role_permissions.findMany({
      select: { role: true, menu_key: true },
    });
    const ada = new Set(tersimpan.map((b) => `${b.role}:${b.menu_key}`));

    const kurang: string[] = [];
    for (const peran of PERAN_DIATUR) {
      for (const kunci of seharusnya) {
        if (!ada.has(`${peran}:${kunci}`)) kurang.push(`${peran}:${kunci}`);
      }
    }

    expect(
      kurang,
      "izin ini belum disemai, jadi centangnya di layar User tidak mencerminkan keadaan sebenarnya",
    ).toEqual([]);
  });

  it("tidak memuat peran yang sudah tidak dikenal kode", async () => {
    // Peran yang dihapus dari kode tetapi barisnya tertinggal akan terus
    // dibaca penjaga halaman, dan tidak terlihat di layar mana pun.
    const tersimpan = await prisma.role_permissions.findMany({ select: { role: true } });
    const asing = [...new Set(tersimpan.map((b) => b.role))].filter(
      (p) => !PERAN.includes(p as (typeof PERAN)[number]),
    );

    expect(asing).toEqual([]);
  });
});

describe("cost melihat dokumen seluruh perusahaan", () => {
  it("TIDAK disaring seperti Sales", () => {
    // Biaya diisi untuk dokumen siapa pun, bukan hanya dokumen yang ia buat
    // sendiri — kalau disaring, sebagian dokumen diam-diam tidak pernah
    // sampai ke bagian Cost, dan tidak ada yang memberitahu.
    const sesi = (peran: string) =>
      ({ id: "7", peran }) as Parameters<typeof hanyaMiliknya>[0];

    expect(hanyaMiliknya(sesi("cost"))).toEqual({});
    expect(hanyaMiliknya(sesi("sales"))).toEqual({ created_by: BigInt(7) });
  });
});
