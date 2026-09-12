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
import { salinPerkiraanBiaya } from "@/lib/margin";
import {
  nomorDokumenBerikutnya,
  type PenjalanKueri,
  simpanDenganKodeUnik,
} from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";
import { hitungStatusInvoice, type StatusInvoice } from "@/lib/uang";

// `klien` wajib diisi klien transaksi: lihat catatan di lib/nomor.ts.
const nomorTagihanBerikutnya = (klien: PenjalanKueri) =>
  nomorDokumenBerikutnya("invoices", "invoice_number", "INV", klien);

export async function simpanTagihan(
  _sebelumnya: KeadaanDokumen,
  data: FormData,
): Promise<KeadaanDokumen> {
  const sesi = await pastikanPeran("sales", "finance");

  const mentah = bacaMuatan(data);
  if (mentah === null) {
    return { pesan: "Data formulir rusak. Muat ulang halaman lalu coba lagi." };
  }

  const siap = siapkanDokumen(mentah, { labelTanggalAkhir: "Jatuh tempo" });
  if (!siap.ok) return siap.keadaan;

  const { f, items, kolom } = siap;

  // Dikirim lewat medan tersembunyi ketika tagihan dibuat dari penawaran.
  const dariPenawaran = String(data.get("dari_penawaran") ?? "").trim();

  let idHasil: string;

  try {
    idHasil = await prisma.$transaction(async (tx) => {
      let idTagihan: bigint;

      if (f.id) {
        const ada = await tx.invoices.findUnique({
          where: { id: BigInt(f.id) },
          select: { status: true, paid_amount: true, due_date: true },
        });
        if (!ada) throw new Error("Invoice tidak ditemukan.");
        if (ada.status === "cancelled") {
          throw new Error("Invoice yang sudah dibatalkan tidak bisa diubah.");
        }
        if (Number(ada.paid_amount) > 0) {
          throw new Error(
            "Invoice ini sudah menerima pembayaran, jadi rinciannya tidak bisa diubah. Batalkan pembayarannya lebih dulu.",
          );
        }

        await tx.invoices.update({
          where: { id: BigInt(f.id) },
          data: {
            ...kolom,
            invoice_date: new Date(f.tanggal),
            due_date: new Date(f.tanggal_akhir),
          },
        });
        await tx.invoice_items.deleteMany({ where: { invoice_id: BigInt(f.id) } });
        idTagihan = BigInt(f.id);
      } else {
        const baru = await simpanDenganKodeUnik(() => nomorTagihanBerikutnya(tx), (nomor) =>
          tx.invoices.create({
            data: {
              ...kolom,
              invoice_date: new Date(f.tanggal),
              due_date: new Date(f.tanggal_akhir),
              invoice_number: nomor,
              quotation_id: dariPenawaran ? BigInt(dariPenawaran) : null,
              status: "unpaid",
              paid_amount: "0",
              created_by: BigInt(sesi.id),
              created_at: new Date(),
            },
            select: { id: true },
          }),
        );
        idTagihan = baru.id;

        // Perkiraan biaya yang sudah disusun di penawaran ikut pindah,
        // supaya tidak perlu diketik ulang. Di dalam transaksi yang sama:
        // tagihan yang terbit tanpa biayanya akan terbaca untung 100%.
        if (dariPenawaran) {
          await salinPerkiraanBiaya(dariPenawaran, idTagihan, sesi.id, tx);
        }
      }

      for (const { induk, anak } of barisUntukDisimpan(items)) {
        const barisInduk = await tx.invoice_items.create({
          data: { ...induk, invoice_id: idTagihan },
          select: { id: true },
        });

        if (anak.length > 0) {
          await tx.invoice_items.createMany({
            data: anak.map((nama) => ({
              invoice_id: idTagihan,
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

      // Grand total mungkin berubah saat diedit, jadi statusnya dihitung ulang
      // supaya "lunas" dan "jatuh tempo" tetap mencerminkan angka terbaru.
      const sesudah = await tx.invoices.findUniqueOrThrow({
        where: { id: idTagihan },
        select: { status: true, grand_total: true, paid_amount: true, due_date: true },
      });

      await tx.invoices.update({
        where: { id: idTagihan },
        data: {
          status: hitungStatusInvoice({
            statusSekarang: sesudah.status as StatusInvoice,
            grandTotal: sesudah.grand_total.toString(),
            totalDibayar: sesudah.paid_amount.toString(),
            dueDate: sesudah.due_date,
          }),
        },
      });

      return idTagihan.toString();
    });
  } catch (galat) {
    return pesanGagal(galat, "Invoice gagal disimpan. Tidak ada data yang berubah.");
  }

  revalidatePath("/tagihan");
  revalidatePath(`/tagihan/${idHasil}`);
  if (dariPenawaran) revalidatePath(`/penawaran/${dariPenawaran}`);

  redirect(`/tagihan/${idHasil}?tersimpan=1`);
}
