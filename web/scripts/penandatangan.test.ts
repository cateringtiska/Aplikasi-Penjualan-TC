import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bolehHapusPenandatangan,
  jumlahDokumenPenandatangan,
  penandatanganAktif,
  tandaTanganDokumen,
} from "../lib/penandatangan";
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

/* ==========================================================================
   MENGHAPUS PENANDATANGAN

   Kolom signatory_id memakai ON DELETE SET NULL, jadi menghapus baris yang
   masih dipakai TIDAK merusak apa pun dan TIDAK melempar galat apa pun —
   dokumen lamanya hanya berpindah diam-diam ke penandatangan aktif yang
   pertama. Satu-satunya tanda bahwa itu terjadi adalah nama yang berbeda di
   cetakan dokumen yang sudah dikirim ke customer.

   Karena itu aturannya dijaga di sini, bukan hanya dipercayakan pada
   tombolnya: tombol bisa saja memanggil aksinya tanpa memeriksa apa pun.
   ========================================================================== */

describe("aturan hapus", () => {
  it("MENOLAK yang sudah dipakai dokumen, dan menyebut jalan keluarnya", async () => {
    const cap = Date.now().toString().slice(-6);
    const pelanggan = await prisma.customers.create({
      data: {
        customer_code: `UTT-${cap}`,
        name: `${TANDA} Pelanggan`,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const tagihan = await prisma.invoices.create({
      data: {
        invoice_number: `UTT-INV-${cap}`,
        customer_id: pelanggan.id,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86_400_000),
        subtotal: "1000000",
        grand_total: "1000000",
        paid_amount: "0",
        status: "unpaid",
        signatory_id: jejak.kedua!,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    try {
      expect(await jumlahDokumenPenandatangan(jejak.kedua!)).toBe(1);

      const izin = await bolehHapusPenandatangan(jejak.kedua!);
      expect(izin.boleh, "baris yang dipakai dokumen boleh dihapus").toBe(false);
      if (!izin.boleh) {
        // Alasannya ikut diperiksa: penolakan tanpa jalan keluar hanya
        // membuat pemakainya mengira aplikasinya rusak.
        expect(izin.alasan).toContain("Nonaktifkan");
      }
    } finally {
      await prisma.invoices.delete({ where: { id: tagihan.id } });
      await prisma.customers.delete({ where: { id: pelanggan.id } });
    }
  });

  it("MENGIZINKAN yang belum pernah dipakai", async () => {
    // Inilah yang perlu bisa dihapus: baris yang tertambah dua kali, atau
    // salah ketik yang belum sempat terpakai.
    expect(await jumlahDokumenPenandatangan(jejak.kedua!)).toBe(0);

    const izin = await bolehHapusPenandatangan(jejak.kedua!);
    expect(izin.boleh, izin.boleh ? "" : izin.alasan).toBe(true);
  });

  it("MENOLAK yang terakhir aktif, walaupun belum dipakai dokumen", async () => {
    // Dokumen baru akan terbit tanpa nama sama sekali, dan tidak ada tanda
    // apa pun bahwa itu terjadi.
    const lain = await prisma.signatories.findMany({
      where: { is_active: true, name: { not: { startsWith: TANDA } } },
      select: { id: true },
    });

    // Yang sungguhan dimatikan sebentar, lalu dikembalikan persis seperti
    // semula — bukan "dinyalakan semua", supaya pilihan pemiliknya tidak
    // ikut berubah karena tes.
    await prisma.signatories.updateMany({
      where: { id: { in: lain.map((s) => s.id) } },
      data: { is_active: false },
    });
    await prisma.signatories.update({
      where: { id: jejak.kedua! },
      data: { is_active: false },
    });

    try {
      // Tinggal "Satu" yang aktif.
      const aktif = await penandatanganAktif();
      expect(aktif.map((a) => a.nama)).toEqual([`${TANDA} Satu`]);

      const izin = await bolehHapusPenandatangan(jejak.pertama!);
      expect(izin.boleh, "penandatangan aktif terakhir boleh dihapus").toBe(false);
    } finally {
      await prisma.signatories.updateMany({
        where: { id: { in: lain.map((s) => s.id) } },
        data: { is_active: true },
      });
      await prisma.signatories.update({
        where: { id: jejak.kedua! },
        data: { is_active: true },
      });
    }
  });

  it("MENOLAK baris yang sudah tidak ada", async () => {
    const izin = await bolehHapusPenandatangan(BigInt("987654321"));
    expect(izin.boleh).toBe(false);
  });

  it("mengembalikan pilihan pemiliknya seperti semula", async () => {
    // Tes di atas mematikan penandatangan yang sungguhan sebentar. Kalau
    // pemulihannya terlewat, pemiliknya akan menemukan daftarnya berubah
    // tanpa pernah menyentuhnya.
    const aktif = await penandatanganAktif();
    const sungguhan = aktif.filter((a) => !a.nama.startsWith(TANDA));
    expect(sungguhan.length, "penandatangan sungguhan ikut termatikan").toBeGreaterThan(0);
  });
});
