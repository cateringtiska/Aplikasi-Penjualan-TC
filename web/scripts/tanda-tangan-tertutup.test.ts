import { afterAll, describe, expect, it } from "vitest";

import { tautanTandaTangan } from "../lib/penyimpanan";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   TANDA TANGAN TIDAK BOLEH PUNYA ALAMAT TETAP

   Gambar tanda tangan adalah bahan untuk memalsukan dokumen atas nama orang
   yang menandatanganinya. Dulu ia disimpan di bucket publik: alamatnya tidak
   bisa ditebak maupun didaftar, tetapi sekali alamat itu diketahui seseorang
   — satu dokumen yang diteruskan, satu tangkapan layar, satu riwayat
   peramban — ia berlaku SELAMANYA, dan tidak ada cara menariknya kembali
   selain mengganti gambarnya.

   Yang dikunci di sini adalah keadaan yang mudah sekali kembali tanpa
   disadari, karena gejalanya TIDAK ADA: dokumen tetap tercetak dengan benar
   entah gambarnya berasal dari bucket publik atau tertutup. Tidak ada yang
   akan menemukannya dari memakai aplikasinya.
   ========================================================================== */

afterAll(async () => {
  await prisma.$disconnect();
});

describe("tanda tangan perusahaan", () => {
  it("tersimpan sebagai jalur berkas, bukan tautan publik", async () => {
    const p = await prisma.company_settings.findUnique({
      where: { id: BigInt(1) },
      select: { signature_path: true },
    });

    if (!p?.signature_path) {
      // Belum ada tanda tangan terpasang — tidak ada yang bisa bocor.
      expect(p?.signature_path ?? null).toBeNull();
      return;
    }

    expect(
      p.signature_path.startsWith("http"),
      `signature_path masih berupa tautan: ${p.signature_path}. ` +
        "Jalankan node scripts/amankan-tanda-tangan.mjs",
    ).toBe(false);
  });

  it("hanya bisa dibuka lewat tautan bertanda waktu", async () => {
    const p = await prisma.company_settings.findUnique({
      where: { id: BigInt(1) },
      select: { signature_path: true },
    });
    if (!p?.signature_path) return;

    const tautan = await tautanTandaTangan(p.signature_path);
    expect(tautan, "tautan bertanda waktu gagal dibuat").toBeTruthy();

    // Tautan bertanda waktu membawa tanda tangannya di alamat; tanpa itu
    // bucketnya menolak.
    expect(tautan).toContain("token=");

    const dengan = await fetch(tautan!, { cache: "no-store" });
    expect(dengan.status, "tautan bertanda waktu harus bisa dibuka").toBe(200);

    // Alamat yang sama tanpa tanda tangannya harus ditolak. Inilah yang
    // membedakan bucket tertutup dari bucket publik bernama acak.
    const tanpa = tautan!.split("?")[0];
    const polos = await fetch(`${tanpa}?periksa=${Date.now()}`, { cache: "no-store" });
    expect(polos.ok, `alamat tanpa tanda waktu masih terbuka: ${tanpa}`).toBe(false);
  });

  it("mengembalikan nilai kosong apa adanya", async () => {
    expect(await tautanTandaTangan(null)).toBeNull();
  });
});
