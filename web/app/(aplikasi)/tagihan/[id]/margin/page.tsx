import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Lock } from "lucide-react";
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

import { bukaKembaliMargin, finalisasiMargin, hapusBiaya, simpanBiaya } from "./actions";

export const metadata: Metadata = { title: "Biaya & margin" };
export const dynamic = "force-dynamic";

export default async function HalamanMargin({ params }: PageProps<"/tagihan/[id]/margin">) {
  const sesi = await wajibIzin("laporan-margin");

  const { id } = await params;

  const [tagihan, biaya, margin] = await Promise.all([
    prisma.invoices.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        subtotal: true,
        grand_total: true,
        pb1_amount: true,
        event_type: true,
        customers: { select: { name: true } },
      },
    }),
    prisma.invoice_costs.findMany({
      where: { invoice_id: BigInt(id) },
      orderBy: { id: "asc" },
    }),
    prisma.invoice_margins.findUnique({
      where: { invoice_id: BigInt(id) },
      include: { users: { select: { name: true } } },
    }),
  ]);

  if (!tagihan) notFound();

  // Dihitung di sini untuk ditampilkan, tanpa menyentuh database. Angka yang
  // tersimpan diperbarui hanya ketika biayanya benar-benar berubah.
  const hasil = hitungMargin({
    penjualan: tagihan.grand_total.toString(),
    biaya: biaya.map((b) => ({
      estimated_amount: b.estimated_amount?.toString() ?? null,
      actual_amount: b.actual_amount?.toString() ?? null,
    })),
  });

  const terkunci = margin?.status === "final";
  const bolehUbah = sesi.peran === "admin" || sesi.peran === "finance";

  return (
    <Halaman>
      <div className="pb-5">
        <Link
          href={`/tagihan/${tagihan.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke {tagihan.invoice_number}
        </Link>
      </div>

      <header className="pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Biaya &amp; margin</h1>
          {terkunci ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong/60 bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
              <Lock className="size-3" />
              Final
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {tagihan.customers.name} · {tagihan.invoice_number} ·{" "}
          {format(tagihan.invoice_date, "d MMMM yyyy", { locale: localeId })}
          {tagihan.event_type ? ` · ${tagihan.event_type}` : ""}
        </p>
      </header>

      <PapanAngka className="mb-6">
        <KartuAngka label="Penjualan bersih" warna="biru" nilai={rupiah(hasil.net_sales)} />
        <KartuAngka
          label="Total biaya"
          nilai={rupiah(hasil.total_cost)}
          keterangan={biaya.length === 0 ? "belum ada biaya dicatat" : undefined}
          warna="oranye"
        />
        <KartuAngka
          label={hasil.profit_status === "untung" ? "Margin" : "Rugi"}
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
        Penjualan yang diakui adalah <strong>seluruh nilai tagihan</strong>
        ({rupiah(tagihan.grand_total)}) — sudah termasuk service charge, delivery, dan PB1.
        {tagihan.pb1_amount && Number(tagihan.pb1_amount) > 0 ? (
          <>
            {" "}
            Tagihan ini memungut PB1 {rupiah(tagihan.pb1_amount)}. Kalau PB1 itu disetorkan,
            catat sebagai baris biaya berkategori <strong>PB1 disetor</strong>; kalau tidak
            dicatat, ia terbaca sebagai bagian dari margin.
          </>
        ) : null}
        {terkunci && margin?.finalized_at ? (
          <>
            {" "}
            Difinalisasi{" "}
            {format(margin.finalized_at, "d MMMM yyyy HH:mm", { locale: localeId })}
            {margin.users ? ` oleh ${margin.users.name}` : ""}.
          </>
        ) : null}
      </p>

      <PanelBiaya
        idDokumen={tagihan.id.toString()}
        bolehUbah={bolehUbah}
        biaya={biaya.map(keBarisTampil)}
        simpan={simpanBiaya}
        hapus={hapusBiaya}
        penguncian={{ terkunci, kunci: finalisasiMargin, buka: bukaKembaliMargin }}
      />
    </Halaman>
  );
}

