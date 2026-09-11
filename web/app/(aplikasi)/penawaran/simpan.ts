"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  bacaMuatan,
  barisUntukDisimpan,
  type KeadaanDokumen,
  pesanGagal,
  siapkanDokumen,
} from "@/lib/dokumen";
import { nomorPenawaranBerikutnya, simpanDenganKodeUnik } from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

export async function simpanPenawaran(
  _sebelumnya: KeadaanDokumen,
  data: FormData,
): Promise<KeadaanDokumen> {
  const sesi = await pastikanPeran("sales", "finance");

  const mentah = bacaMuatan(data);
  if (mentah === null) {
    return { pesan: "Data formulir rusak. Muat ulang halaman lalu coba lagi." };
  }

  const siap = siapkanDokumen(mentah, { labelTanggalAkhir: "Tanggal berlaku" });
  if (!siap.ok) return siap.keadaan;

  const { f, items, kolom } = siap;

  let idHasil: string;

  try {
    // Seluruh penyimpanan dalam satu transaksi. Gagal di tengah berarti tidak
    // ada yang berubah sama sekali — bukan penawaran bertotal terisi tanpa
    // satu baris item pun, seperti yang bisa terjadi di versi Laravel.
    idHasil = await prisma.$transaction(async (tx) => {
      let idPenawaran: bigint;

      if (f.id) {
        const ada = await tx.quotations.findUnique({
          where: { id: BigInt(f.id) },
          select: { status: true },
        });
        if (!ada) throw new Error("Quotation tidak ditemukan.");
        if (ada.status === "approved") {
          throw new Error("Quotation yang sudah disetujui tidak bisa diubah lagi.");
        }

        await tx.quotations.update({
          where: { id: BigInt(f.id) },
          data: {
            ...kolom,
            quotation_date: new Date(f.tanggal),
            valid_until: new Date(f.tanggal_akhir),
          },
        });
        await tx.quotation_items.deleteMany({ where: { quotation_id: BigInt(f.id) } });
        idPenawaran = BigInt(f.id);
      } else {
        const baru = await simpanDenganKodeUnik(() => nomorPenawaranBerikutnya(tx), (nomor) =>
          tx.quotations.create({
            data: {
              ...kolom,
              quotation_date: new Date(f.tanggal),
              valid_until: new Date(f.tanggal_akhir),
              quotation_number: nomor,
              status: "draft",
              created_by: BigInt(sesi.id),
              created_at: new Date(),
            },
            select: { id: true },
          }),
        );
        idPenawaran = baru.id;
      }

      for (const { induk, anak } of barisUntukDisimpan(items)) {
        const barisInduk = await tx.quotation_items.create({
          data: { ...induk, quotation_id: idPenawaran },
          select: { id: true },
        });

        if (anak.length > 0) {
          await tx.quotation_items.createMany({
            data: anak.map((nama) => ({
              quotation_id: idPenawaran,
              parent_id: barisInduk.id,
              item_name: nama,
              unit: null,
              qty: "0",
              price: "0",
              subtotal: "0",
              is_compliment: false,
              charge_service: false,
              created_at: new Date(),
              updated_at: new Date(),
            })),
          });
        }
      }

      return idPenawaran.toString();
    });
  } catch (galat) {
    return pesanGagal(galat, "Quotation gagal disimpan. Tidak ada data yang berubah.");
  }

  revalidatePath("/penawaran");
  revalidatePath(`/penawaran/${idHasil}`);
  redirect(`/penawaran/${idHasil}?tersimpan=1`);
}
