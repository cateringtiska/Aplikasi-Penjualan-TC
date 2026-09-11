"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { NILAI_KATEGORI } from "@/lib/biaya";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";
import { hitungMargin, uraikanRupiah } from "@/lib/uang";

/* ==========================================================================
   BIAYA & MARGIN PER TAGIHAN

   Satu perbedaan penting dari Laravel: di sana perhitungan margin dipanggil
   dari dalam fungsi render, sehingga setiap ketikan di formulir biaya
   menghasilkan satu operasi tulis ke database. Di sini margin hanya dihitung
   ulang setelah biaya benar-benar berubah.
   ========================================================================== */

const skema = z.object({
  id: z.string().trim().optional(),
  invoice_id: z.string().trim().min(1),
  category: z.enum(NILAI_KATEGORI as unknown as [string, ...string[]], {
    message: "Pilih kategori biaya.",
  }),
  description: z.string().trim().min(3, "Keterangan minimal 3 huruf.").max(255),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type KeadaanBiaya = {
  sukses?: boolean;
  pesan?: string;
  galat?: Record<string, string>;
  /**
   * Penanda unik untuk setiap penyimpanan yang berhasil.
   *
   * Dipakai formulir sebagai `key` React, sehingga seluruh isian kembali
   * kosong dengan sendirinya — tanpa perlu membersihkannya satu per satu
   * lewat effect.
   */
  tanda?: string;
};

export async function simpanBiaya(
  _sebelumnya: KeadaanBiaya,
  data: FormData,
): Promise<KeadaanBiaya> {
  const sesi = await pastikanPeran("finance");

  const hasil = skema.safeParse(Object.fromEntries(data));
  if (!hasil.success) {
    const bidang = z.flattenError(hasil.error).fieldErrors;
    return {
      galat: Object.fromEntries(
        Object.entries(bidang).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }

  const { id, invoice_id, category, description, notes } = hasil.data;

  const estimasi = uraikanRupiah(data.get("estimated_amount"));
  const aktual = uraikanRupiah(data.get("actual_amount"));

  const teksEstimasi = String(data.get("estimated_amount") ?? "").trim();
  const teksAktual = String(data.get("actual_amount") ?? "").trim();

  if (teksEstimasi !== "" && estimasi === null) {
    return { galat: { estimated_amount: "Isi angka saja, contoh: 5.000.000" } };
  }
  if (teksAktual !== "" && aktual === null) {
    return { galat: { actual_amount: "Isi angka saja, contoh: 5.400.000" } };
  }
  if (estimasi === null && aktual === null) {
    return { galat: { estimated_amount: "Isi minimal salah satu: estimasi atau aktual." } };
  }

  const terkunci = await marginTerkunci(invoice_id);
  if (terkunci) {
    return { pesan: "Margin sudah difinalisasi. Buka kembali dulu sebelum mengubah biaya." };
  }

  const isi = {
    category,
    description,
    estimated_amount: estimasi ? estimasi.toFixed(2) : null,
    actual_amount: aktual ? aktual.toFixed(2) : null,
    // Sebuah baris dianggap "aktual" hanya kalau angkanya benar-benar di atas
    // nol — sama dengan aturan yang dipakai saat menghitung nilainya.
    status: aktual && aktual.gt(0) ? "aktual" : "estimasi",
    notes: notes || null,
    updated_at: new Date(),
  };

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
  } catch {
    return { pesan: "Baris biaya gagal disimpan." };
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

/**
 * Menghitung ulang margin satu tagihan dari seluruh baris biayanya.
 *
 * Selalu dihitung dari nol, tidak pernah menambah atau mengurangi angka yang
 * tersimpan — jadi menghapus baris biaya pun otomatis benar.
 */
export async function hitungUlangMargin(idTagihan: string): Promise<void> {
  const [tagihan, biaya] = await Promise.all([
    prisma.invoices.findUniqueOrThrow({
      where: { id: BigInt(idTagihan) },
      select: { subtotal: true },
    }),
    prisma.invoice_costs.findMany({
      where: { invoice_id: BigInt(idTagihan) },
      select: { estimated_amount: true, actual_amount: true },
    }),
  ]);

  const hasil = hitungMargin({
    subtotalInvoice: tagihan.subtotal.toString(),
    biaya: biaya.map((b) => ({
      estimated_amount: b.estimated_amount?.toString() ?? null,
      actual_amount: b.actual_amount?.toString() ?? null,
    })),
  });

  await prisma.invoice_margins.upsert({
    where: { invoice_id: BigInt(idTagihan) },
    create: {
      invoice_id: BigInt(idTagihan),
      net_sales: hasil.net_sales.toFixed(2),
      total_cost: hasil.total_cost.toFixed(2),
      profit: hasil.profit.toFixed(2),
      margin_percent: hasil.margin_percent.toFixed(2),
      profit_status: hasil.profit_status,
      status: "draft",
      created_at: new Date(),
      updated_at: new Date(),
    },
    update: {
      net_sales: hasil.net_sales.toFixed(2),
      total_cost: hasil.total_cost.toFixed(2),
      profit: hasil.profit.toFixed(2),
      margin_percent: hasil.margin_percent.toFixed(2),
      profit_status: hasil.profit_status,
      updated_at: new Date(),
    },
  });
}
