import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Halaman } from "@/components/halaman";
import { KartuAngka, PapanAngka } from "@/components/kartu-angka";
import { PanelBiaya } from "@/components/panel-biaya";
import { keBarisTampil } from "@/lib/biaya";
import { prisma } from "@/lib/prisma";
import { wajibIzin } from "@/lib/rbac";
import { hitungMargin, rupiah } from "@/lib/uang";

import { hapusBiayaPenawaran, simpanBiayaPenawaran } from "./actions";

export const metadata: Metadata = { title: "Perkiraan biaya & margin" };
export const dynamic = "force-dynamic";

export default async function HalamanMarginPenawaran({
  params,
}: PageProps<"/penawaran/[id]/margin">) {
  const sesi = await wajibIzin("laporan-margin");

  const { id } = await params;

  const [penawaran, biaya] = await Promise.all([
    prisma.quotations.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        quotation_number: true,
        quotation_date: true,
        subtotal: true,
        grand_total: true,
        event_type: true,
        status: true,
        customers: { select: { name: true } },
      },
    }),
    prisma.quotation_costs.findMany({
      where: { quotation_id: BigInt(id) },
      orderBy: { id: "asc" },
    }),
  ]);

  if (!penawaran) notFound();

  const hasil = hitungMargin({
    penjualan: penawaran.grand_total.toString(),
    biaya: biaya.map((b) => ({
      estimated_amount: b.estimated_amount?.toString() ?? null,
      actual_amount: b.actual_amount?.toString() ?? null,
    })),
  });

  const bolehUbah = sesi.peran === "admin" || sesi.peran === "finance";

  return (
    <Halaman>
      <div className="pb-5">
        <Link
          href={`/penawaran/${penawaran.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke {penawaran.quotation_number}
        </Link>
      </div>

      <header className="pb-6">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          Perkiraan biaya &amp; margin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {penawaran.customers.name} · {penawaran.quotation_number} ·{" "}
          {format(penawaran.quotation_date, "d MMMM yyyy", { locale: localeId })}
          {penawaran.event_type ? ` · ${penawaran.event_type}` : ""}
        </p>
      </header>

      <PapanAngka className="mb-6">
        <KartuAngka label="Penjualan bersih" warna="biru" nilai={rupiah(hasil.net_sales)} />
        <KartuAngka label="Perkiraan biaya" warna="oranye" nilai={rupiah(hasil.total_cost)} />
        <KartuAngka
          label={hasil.profit_status === "untung" ? "Perkiraan margin" : "Perkiraan rugi"}
          nilai={rupiah(hasil.profit.abs())}
          menonjol
          warna={hasil.profit_status === "rugi" ? "merah" : "hijau"}
        />
        <KartuAngka
          label="Margin %"
          nilai={`${hasil.margin_percent.toString().replace(".", ",")}%`}
          warna={hasil.profit_status === "rugi" ? "merah" : "ungu"}
        />
      </PapanAngka>

      <p className="mb-6 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
        Angka di sini <strong>perkiraan</strong>, dipakai untuk menimbang harga sebelum
        quotation dikirim. Penjualan yang diakui adalah seluruh nilai quotation
        ({rupiah(penawaran.grand_total)}), sudah termasuk service charge, delivery, dan PB1.
        Kalau PB1 akan disetorkan, catat sebagai baris biaya berkategori{" "}
        <strong>PB1 disetor</strong>. Saat quotation ini dijadikan invoice, seluruh baris
        biaya di bawah ikut tersalin, lalu di sana diperbarui menjadi angka yang sebenarnya.
      </p>

      <PanelBiaya
        idDokumen={penawaran.id.toString()}
        bolehUbah={bolehUbah}
        biaya={biaya.map(keBarisTampil)}
        simpan={simpanBiayaPenawaran}
        hapus={hapusBiayaPenawaran}
      />
    </Halaman>
  );
}

