import { format } from "date-fns";
import { type NextRequest, NextResponse } from "next/server";

import { penggunaAktif } from "@/lib/auth";
import { buatBukuPenjualan } from "@/lib/excel-penjualan";
import { tambahLembarRincian, judulBulan } from "@/lib/excel-rincian";
import { ambilLaporan, ambilRincianItem, bacaSaring, judulPeriode } from "@/lib/laporan-penjualan";
import { prisma } from "@/lib/prisma";
import { hanyaMiliknya } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Mengunduh laporan penjualan sebagai berkas Excel.
 *
 * Bentuk berkasnya disusun di lib/excel-penjualan.ts; di sini hanya hak
 * akses, penyaringan, dan pengambilan datanya.
 *
 * Nilai uang ditulis sebagai ANGKA, bukan teks — supaya bisa dijumlah
 * langsung di Excel oleh siapa pun yang menerimanya.
 */
export async function GET(request: NextRequest) {
  // Dibaca ulang dari database, bukan dari cookie: pengguna yang sudah
  // dinonaktifkan tidak boleh masih bisa mengunduh laporan penjualan.
  const sesi = await penggunaAktif();
  if (!sesi) {
    return NextResponse.json({ pesan: "Silakan masuk lebih dulu." }, { status: 401 });
  }
  if (!["admin", "sales", "finance"].includes(sesi.peran)) {
    return NextResponse.json({ pesan: "Anda tidak punya akses." }, { status: 403 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const saring = bacaSaring(params);

  const [{ baris }, rincian, perusahaan] = await Promise.all([
    ambilLaporan(saring, hanyaMiliknya(sesi)),
    ambilRincianItem(saring, hanyaMiliknya(sesi)),
    prisma.company_settings.findUnique({
      where: { id: BigInt(1) },
      select: { company_name: true, logo_path: true },
    }),
  ]);

  const buku = await buatBukuPenjualan({
    baris,
    periode: judulPeriode(saring),
    perusahaan: {
      nama: perusahaan?.company_name ?? "Perusahaan",
      logo: await ambilLogo(perusahaan?.logo_path ?? null),
    },
    dicetakOleh: sesi.nama,
  });

  // Lembar tambahan bergaya laporan bulanan lama: satu blok per invoice,
  // setiap item satu baris, lalu subtotal.
  tambahLembarRincian(buku, {
    invoices: rincian,
    namaPerusahaan: perusahaan?.company_name ?? "Perusahaan",
    periode: judulBulan(saring.dari, saring.sampai, judulPeriode(saring)),
  });

  const isi = await buku.xlsx.writeBuffer();
  const namaBerkas = `laporan-penjualan-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;

  return new NextResponse(isi as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Mengambil logo untuk ditempel di kop.
 *
 * Gagal mengambilnya TIDAK menggagalkan laporannya. Logo adalah hiasan;
 * angkanya yang dicari orang, dan menolak menerbitkan laporan karena
 * gambarnya tidak terunduh akan menukar sesuatu yang penting dengan sesuatu
 * yang tidak.
 */
async function ambilLogo(tautan: string | null): Promise<ArrayBuffer | null> {
  if (!tautan || !tautan.startsWith("http")) return null;

  try {
    const tanggapan = await fetch(tautan, { cache: "no-store" });
    if (!tanggapan.ok) return null;
    return await tanggapan.arrayBuffer();
  } catch (galat) {
    console.error("Logo gagal diambil untuk laporan Excel", galat);
    return null;
  }
}
