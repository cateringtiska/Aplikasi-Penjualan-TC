"use server";

import { revalidatePath } from "next/cache";

import type { KeadaanBiaya } from "@/lib/biaya";
import { pesanGagal } from "@/lib/dokumen";
import { bacaFormulirBiaya } from "@/lib/biaya-masukan";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   PERKIRAAN BIAYA PADA PENAWARAN

   Keputusan yang paling menentukan untung-rugi sebuah acara diambil jauh
   sebelum tagihan terbit: saat harga penawaran disusun. Di sinilah biayanya
   diperkirakan, supaya marginnya sudah terlihat SEBELUM harga dikirim ke
   klien — bukan baru ketahuan setelah acaranya lewat.

   Dua hal sengaja TIDAK ada di sini, dan keduanya bukan kelalaian:

   1. Tidak ada finalisasi. Ini perkiraan; angkanya memang masih boleh
      berubah selama penawaran belum disetujui. Yang dikunci hanyalah angka
      nyata di tagihan.

   2. Tidak ada tabel ringkasan margin. Angkanya dihitung saat dibaca, jadi
      tidak ada ringkasan yang bisa basi terhadap baris biayanya.

   Barisnya disalin ke invoice_costs ketika penawaran ini dijadikan tagihan —
   lihat simpanTagihan.
   ========================================================================== */

export async function simpanBiayaPenawaran(
  _sebelumnya: KeadaanBiaya,
  data: FormData,
): Promise<KeadaanBiaya> {
  const sesi = await pastikanPeran("finance");

  const baca = bacaFormulirBiaya(data);
  if (!baca.ok) return { galat: baca.galat };

  const { id, idDokumen, isi } = baca;

  try {
    if (id) {
      await prisma.quotation_costs.update({ where: { id: BigInt(id) }, data: isi });
    } else {
      await prisma.quotation_costs.create({
        data: {
          ...isi,
          quotation_id: BigInt(idDokumen),
          created_by: BigInt(sesi.id),
          created_at: new Date(),
        },
      });
    }
  } catch (galat) {
    return pesanGagal(galat, "Baris biaya gagal disimpan.");
  }

  revalidatePath(`/penawaran/${idDokumen}/margin`);
  revalidatePath("/laporan/margin");

  return {
    sukses: true,
    tanda: crypto.randomUUID(),
    pesan: id ? "Baris biaya diperbarui." : "Baris biaya ditambahkan.",
  };
}

export async function hapusBiayaPenawaran(
  idBiaya: string,
  idPenawaran: string,
): Promise<void> {
  await pastikanPeran("finance");

  await prisma.quotation_costs.delete({ where: { id: BigInt(idBiaya) } });

  revalidatePath(`/penawaran/${idPenawaran}/margin`);
  revalidatePath("/laporan/margin");
}
