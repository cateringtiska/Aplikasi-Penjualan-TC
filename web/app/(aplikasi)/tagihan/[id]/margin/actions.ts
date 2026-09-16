"use server";

import { revalidatePath } from "next/cache";

import type { KeadaanBiaya } from "@/lib/biaya";
import { pesanGagal } from "@/lib/dokumen";
import { bacaFormulirBiaya } from "@/lib/biaya-masukan";
import { hitungUlangMargin } from "@/lib/margin";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   BIAYA & MARGIN PER TAGIHAN

   Satu perbedaan penting dari Laravel: di sana perhitungan margin dipanggil
   dari dalam fungsi render, sehingga setiap ketikan di formulir biaya
   menghasilkan satu operasi tulis ke database. Di sini margin hanya dihitung
   ulang setelah biaya benar-benar berubah.
   ========================================================================== */

export async function simpanBiaya(
  _sebelumnya: KeadaanBiaya,
  data: FormData,
): Promise<KeadaanBiaya> {
  const sesi = await pastikanPeran("finance");

  const baca = bacaFormulirBiaya(data);
  if (!baca.ok) return { galat: baca.galat };

  const { id, idDokumen: invoice_id, isi } = baca;

  const terkunci = await marginTerkunci(invoice_id);
  if (terkunci) {
    return { pesan: "Margin sudah difinalisasi. Buka kembali dulu sebelum mengubah biaya." };
  }

  try {
    if (id) {
      await prisma.invoice_costs.update({ where: { id: BigInt(id) }, data: isi });
    } else {
      await prisma.invoice_costs.create({
        data: {
          ...isi,
          invoice_id: BigInt(invoice_id),
          created_by: BigInt(sesi.id),
          created_at: new Date(),
        },
      });
    }
  } catch (galat) {
    return pesanGagal(galat, "Baris biaya gagal disimpan.");
  }

  await hitungUlangMargin(invoice_id);
  revalidatePath(`/tagihan/${invoice_id}/margin`);

  return {
    sukses: true,
    tanda: crypto.randomUUID(),
    pesan: id ? "Baris biaya diperbarui." : "Baris biaya ditambahkan.",
  };
}

export async function hapusBiaya(idBiaya: string, idTagihan: string): Promise<void> {
  await pastikanPeran("finance");

  if (await marginTerkunci(idTagihan)) {
    throw new Error("Margin sudah difinalisasi. Buka kembali dulu sebelum menghapus biaya.");
  }

  await prisma.invoice_costs.delete({ where: { id: BigInt(idBiaya) } });
  await hitungUlangMargin(idTagihan);
  revalidatePath(`/tagihan/${idTagihan}/margin`);
}

export async function finalisasiMargin(idTagihan: string): Promise<void> {
  const sesi = await pastikanPeran("finance");

  // Tagihan tanpa satu pun catatan biaya selalu terbaca 100% untung. Mengunci
  // angka itu berarti mengunci angka yang sudah pasti keliru — dan justru
  // setelah terkunci, biayanya tidak bisa lagi dimasukkan, karena simpanBiaya
  // menolak semua perubahan pada margin yang sudah final.
  //
  // Tombolnya pun duduk tepat di atas formulir biaya, jadi mudah tertekan
  // ketika yang dimaksud sebenarnya "Tambah biaya".
  const jumlahBiaya = await prisma.invoice_costs.count({
    where: { invoice_id: BigInt(idTagihan) },
  });

  if (jumlahBiaya === 0) {
    throw new Error(
      "Belum ada biaya yang dicatat, jadi margin ini masih terbaca 100% untung. Catat biayanya dulu lewat \"Tambah biaya\", baru difinalisasi.",
    );
  }

  await hitungUlangMargin(idTagihan);

  await prisma.invoice_margins.update({
    where: { invoice_id: BigInt(idTagihan) },
    data: {
      status: "final",
      finalized_at: new Date(),
      finalized_by: BigInt(sesi.id),
      updated_at: new Date(),
    },
  });

  revalidatePath(`/tagihan/${idTagihan}/margin`);
  revalidatePath("/laporan/margin");
}

export async function bukaKembaliMargin(idTagihan: string): Promise<void> {
  await pastikanPeran("finance");

  await prisma.invoice_margins.update({
    where: { invoice_id: BigInt(idTagihan) },
    data: {
      status: "draft",
      finalized_at: null,
      finalized_by: null,
      updated_at: new Date(),
    },
  });

  revalidatePath(`/tagihan/${idTagihan}/margin`);
  revalidatePath("/laporan/margin");
}

async function marginTerkunci(idTagihan: string): Promise<boolean> {
  const margin = await prisma.invoice_margins.findUnique({
    where: { invoice_id: BigInt(idTagihan) },
    select: { status: true },
  });
  return margin?.status === "final";
}
