import { NextResponse } from "next/server";

import { buatExcelDokumen, namaBerkasDokumen } from "@/lib/excel-dokumen";
import { isiDokumenTagihan } from "@/lib/isi-dokumen";
import { hanyaMiliknya, pastikanIzin } from "@/lib/rbac";

/**
 * Invoice ini sebagai berkas Excel, isinya sama dengan hasil cetaknya.
 *
 * Dibaca lewat pintu yang sama dengan halaman cetaknya, dan barisnya disusun
 * oleh modul yang sama. Lihat lib/isi-dokumen.ts dan lib/baris-cetak.ts.
 */
export async function GET(_minta: Request, { params }: RouteContext<"/tagihan/[id]/excel">) {
  // Dibaca ulang dari database, bukan dari cookie: dokumen ini memuat
  // seluruh rincian harga, dan pengguna yang sudah dinonaktifkan atau
  // dicabut aksesnya tidak boleh masih bisa mengunduhnya.
  const sesi = await pastikanIzin("tagihan").catch(() => null);
  if (!sesi) {
    return NextResponse.json({ pesan: "Anda tidak punya akses." }, { status: 403 });
  }

  const { id } = await params;
  const isi = await isiDokumenTagihan(id, hanyaMiliknya(sesi));

  if (!isi) {
    return NextResponse.json({ pesan: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const berkas = await buatExcelDokumen(isi);

  return new NextResponse(berkas, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkasDokumen(isi.nomor, isi.tanggal)}"`,
      "Cache-Control": "no-store",
    },
  });
}
