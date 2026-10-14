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
import { tulisBiayaTambahanTagihan } from "@/lib/biaya-tambahan";
import { tulisTanggalAcaraTagihan } from "@/lib/tanggal-acara";
import { salinPerkiraanBiaya } from "@/lib/margin";
import {
  nomorDokumenBerikutnya,
  type PenjalanKueri,
  simpanDenganKodeUnik,
} from "@/lib/nomor";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya, pastikanIzin } from "@/lib/rbac";
import {
  d,
  hitungStatusInvoice,
  revisiInvoiceSah,
  rupiah,
  type StatusInvoice,
} from "@/lib/uang";

// `klien` wajib diisi klien transaksi: lihat catatan di lib/nomor.ts.
const nomorTagihanBerikutnya = (klien: PenjalanKueri) =>
  nomorDokumenBerikutnya("invoices", "invoice_number", "INV", klien);

export async function simpanTagihan(
  _sebelumnya: KeadaanDokumen,
  data: FormData,
): Promise<KeadaanDokumen> {
  const sesi = await pastikanIzin("tagihan");

  const mentah = bacaMuatan(data);
  if (mentah === null) {
    return { pesan: "Data formulir rusak. Muat ulang halaman lalu coba lagi." };
  }

  const siap = siapkanDokumen(mentah, { labelTanggalAkhir: "Jatuh tempo" });
  if (!siap.ok) return siap.keadaan;

  const { f, items, tambahan, tanggalAcara, kolom } = siap;

  // Kosong disimpan sebagai NULL, bukan sebagai teks kosong: keduanya
  // terbaca sama di layar, tetapi hanya NULL yang bisa dibedakan saat
  // mencari invoice yang belum punya nomor PO.
  const referensiPo = (f.po_reference ?? "").trim() || null;

  // Dikirim lewat medan tersembunyi ketika tagihan dibuat dari penawaran.
  const dariPenawaran = String(data.get("dari_penawaran") ?? "").trim();

  let idHasil: string;

  try {
    idHasil = await prisma.$transaction(async (tx) => {
      let idTagihan: bigint;

      if (f.id) {
        // Penyaring kepemilikan ikut ke dalam pencarian: formulir mengirim
        // nomor dokumennya, dan nomor bisa diganti sendiri sebelum dikirim.
        const ada = await tx.invoices.findFirst({
          where: { id: BigInt(f.id), ...hanyaMiliknya(sesi) },
          select: { status: true, paid_amount: true, due_date: true, revision: true },
        });
        if (!ada) throw new Error("Invoice tidak ditemukan.");
        if (ada.status === "cancelled") {
          throw new Error("Invoice yang sudah dibatalkan tidak bisa diubah.");
        }

        /* ------------------------------------------------------------------
           REVISI HANYA BOLEH NAIK

           Tambahan menu saat acara berlangsung adalah kejadian biasa di
           katering, dan invoice-nya sudah telanjur dikirim beserta DP yang
           sudah dibayar. Jadi invoice yang sudah menerima payment BOLEH
           diubah — tetapi nilainya tidak boleh jatuh di bawah uang yang
           sudah masuk.

           Kalau boleh turun, yang dibayar menjadi lebih besar daripada yang
           ditagihkan: kelebihannya tidak punya tempat, invoice-nya terbaca
           "Lunas" padahal ada uang menggantung, dan tidak ada satu pun layar
           yang memperlihatkan bahwa itu terjadi. Alokasi pembayarannya
           sendiri tetap utuh — yang berubah hanya nilai invoice-nya, dan
           sisanya dihitung ulang di bawah.
           ------------------------------------------------------------------ */
        const sudahDibayar = d(ada.paid_amount);
        const nilaiBaru = d(kolom.grand_total);

        if (!revisiInvoiceSah(nilaiBaru, sudahDibayar)) {
          throw new Error(
            `Nilai invoice barunya ${rupiah(nilaiBaru)}, lebih kecil daripada payment ` +
              `yang sudah diterima ${rupiah(sudahDibayar)}. Kurangi atau hapus payment-nya ` +
              "lebih dulu kalau nilainya memang harus turun.",
          );
        }

        // Penanda revisi hanya naik ketika memang SUDAH ADA PAYMENT, yang
        // berarti dokumennya sudah beredar dan uangnya sudah bergerak.
        // Membetulkan invoice yang belum dibayar bukan revisi — tidak ada
        // siapa pun di luar sana yang memegang versi lamanya.
        const direvisi = sudahDibayar.gt(0);

        await tx.invoices.update({
          where: { id: BigInt(f.id) },
          data: {
            ...kolom,
            po_reference: referensiPo,
            invoice_date: new Date(f.tanggal),
            due_date: new Date(f.tanggal_akhir),
            ...(direvisi ? { revision: ada.revision + 1, revised_at: new Date() } : {}),
          },
        });
        await tx.invoice_items.deleteMany({ where: { invoice_id: BigInt(f.id) } });
        idTagihan = BigInt(f.id);
      } else {
        const baru = await simpanDenganKodeUnik(() => nomorTagihanBerikutnya(tx), (nomor) =>
          tx.invoices.create({
            data: {
              ...kolom,
              po_reference: referensiPo,
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
            // Sub-item kini membawa qty dan harganya sendiri. Penanda
            // pungutan TIDAK disimpan di sini: ia diwarisi dari induknya saat
            // menghitung, dan menyimpan salinannya hanya membuka peluang
            // keduanya menyimpang.
            data: anak.map((a) => ({
              invoice_id: idTagihan,
              parent_id: barisInduk.id,
              item_name: a.item_name,
              unit: a.unit,
              day: a.day,
              qty: a.qty,
              price: a.price,
              subtotal: a.subtotal,
              is_compliment: false,
              charge_service: false,
              created_at: new Date(),
              updated_at: new Date(),
            })),
          });
        }
      }

      // Biaya tambahan ditulis dalam transaksi yang sama. Grand total sudah
      // memuat jumlahnya; kalau barisnya gagal masuk, dokumennya menagih
      // angka yang tidak bisa dijelaskan rinciannya sendiri.
      await tulisBiayaTambahanTagihan(idTagihan, tambahan, tx);
      await tulisTanggalAcaraTagihan(idTagihan, tanggalAcara, tx);

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
