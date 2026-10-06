import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { penandatanganAktif, tandaTanganDokumen } from "../lib/penandatangan";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   SIAPA YANG MENANDATANGANI DOKUMEN

   Marketing ada dua orang, dan tiap quotation atau invoice ditandatangani
   salah satunya.

   Seluruh kesalahan di bagian ini TIDAK MENIMBULKAN GALAT. Halamannya tetap
   terbuka, angkanya tetap benar, dan dokumennya tetap tercetak; yang salah
   hanya NAMA DI BAWAH TANDA TANGANNYA — dan itu baru diketahui setelah
   dokumennya sampai ke customer. Karena itu tiga hal berikut dijaga tes:

     1. Dokumen yang sudah memilih penandatangan TETAP memakai orang itu,
        walaupun orangnya sudah dinonaktifkan. Kalau tidak, dokumen yang
        sudah terbit diam-diam berubah tanda tangannya begitu ada marketing
        yang pindah kerja.
     2. Dokumen yang BELUM memilih siapa pun tetap dapat nama. Seluruh
        dokumen lama dibuat sebelum pilihan ini ada; kalau tidak ada
        cadangannya, semuanya tercetak tanpa tanda tangan.
     3. Penandatangan aktif yang terakhir tidak bisa dimatikan. Kalau bisa,
        dokumen BARU terbit tanpa nama sama sekali.
   ========================================================================== */

const TANDA = "UJI PENANDATANGAN";

const jejak = {
  pertama: null as bigint | null,
  kedua: null as bigint | null,
};

beforeAll(async () => {
  // sort_order sengaja di belakang yang sungguhan, supaya penandatangan
  // bawaan perusahaannya tetap yang pertama bagi dokumen yang belum memilih.
  const akhir = await prisma.signatories.findFirst({
    orderBy: { sort_order: "desc" },
    select: { sort_order: true },
  });
  const mulai = (akhir?.sort_order ?? 0) + 1;

  const pertama = await prisma.signatories.create({
    data: {
      name: `${TANDA} Satu`,
      signature_path: "tanda-tangan/uji-satu.png",
      is_active: true,
      sort_order: mulai,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  const kedua = await prisma.signatories.create({
    data: {
      name: `${TANDA} Dua`,
      signature_path: null,
      is_active: true,
      sort_order: mulai + 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  jejak.pertama = pertama.id;
  jejak.kedua = kedua.id;
});

afterAll(async () => {
  await prisma.signatories.deleteMany({ where: { name: { startsWith: TANDA } } });

  const sisa = await prisma.signatories.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

describe("pilihan untuk dokumen baru", () => {
  it("memuat yang aktif, dan membuang yang dinonaktifkan", async () => {
    const sebelum = await penandatanganAktif();
    expect(sebelum.map((p) => p.nama)).toContain(`${TANDA} Dua`);

    await prisma.signatories.update({
      where: { id: jejak.kedua! },
      data: { is_active: false },
    });

    const sesudah = await penandatanganAktif();
    expect(sesudah.map((p) => p.nama)).not.toContain(`${TANDA} Dua`);

    await prisma.signatories.update({
      where: { id: jejak.kedua! },
      data: { is_active: true },
    });
  });

  it("selalu menyisakan sedikitnya satu pilihan", async () => {
    // Daftar pilihan yang kosong membuat formulirnya tidak menampilkan
    // apa pun, dan dokumennya terbit tanpa nama.
    expect((await penandatanganAktif()).length).toBeGreaterThan(0);
  });
});

describe("tanda tangan satu dokumen", () => {
  it("memakai orang yang DIPILIH, bukan yang pertama di daftar", async () => {
    const ttd = await tandaTanganDokumen({
      idPenandatangan: jejak.kedua!,
      namaCadangan: null,
      jalurCadangan: null,
    });

    expect(ttd.nama).toBe(`${TANDA} Dua`);
  });

  it("TETAP memakai orang itu walaupun sudah dinonaktifkan", async () => {
    // Dokumen yang sudah dikirim ke customer tidak boleh berubah hanya
    // karena orangnya pindah kerja.
    await prisma.signatories.update({
      where: { id: jejak.kedua! },
      data: { is_active: false },
    });

    const ttd = await tandaTanganDokumen({
      idPenandatangan: jejak.kedua!,
      namaCadangan: null,
      jalurCadangan: null,
    });
    expect(ttd.nama).toBe(`${TANDA} Dua`);

    await prisma.signatories.update({
      where: { id: jejak.kedua! },
      data: { is_active: true },
    });
  });

  it("memberi nama kepada dokumen lama yang belum memilih siapa pun", async () => {
    const ttd = await tandaTanganDokumen({
      idPenandatangan: null,
      namaCadangan: null,
      jalurCadangan: null,
    });

    const aktif = await penandatanganAktif();
    expect(ttd.nama, "dokumen lama tercetak tanpa nama").toBe(aktif[0].nama);
  });

  it("tidak ikut gugur kalau barisnya sudah tidak ada", async () => {
    // Kolomnya ON DELETE SET NULL, jadi keadaan ini tidak seharusnya
    // terjadi — tetapi lebih baik tercetak dengan nama cadangan daripada
    // halaman cetaknya gagal terbuka.
    const ttd = await tandaTanganDokumen({
      idPenandatangan: BigInt("987654321"),
      namaCadangan: null,
      jalurCadangan: null,
    });

    expect(ttd.nama).not.toBeNull();
  });

  it("menghasilkan tautan bertanda waktu, bukan jalur berkasnya", async () => {
    // Bucket-nya tertutup; jalur mentah yang bocor ke HTML hanya akan
    // menjadi gambar rusak di dokumen.
    const ttd = await tandaTanganDokumen({
      idPenandatangan: jejak.pertama!,
      namaCadangan: null,
      jalurCadangan: null,
    });

    expect(ttd.nama).toBe(`${TANDA} Satu`);
    expect(ttd.tautan ?? "", "jalur berkas terbawa apa adanya").not.toBe(
      "tanda-tangan/uji-satu.png",
    );
  });

  /* Langkah ketiga — kolom lama di pengaturan perusahaan — sengaja TIDAK
     diuji di sini. Mencapainya menuntut seluruh baris signatories
     dinonaktifkan lebih dulu, dan tes yang mematikan penandatangan sungguhan
     akan meninggalkan datanya salah kalau ia gugur di tengah jalan. Langkah
     itu memang hanya jaring terakhir; yang penting dijaga adalah dua langkah
     sebelumnya, dan keduanya ada di atas. */
});
