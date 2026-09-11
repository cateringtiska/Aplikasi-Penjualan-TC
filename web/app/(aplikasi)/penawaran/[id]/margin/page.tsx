import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Halaman } from "@/components/halaman";
import { PanelBiaya } from "@/components/panel-biaya";
import { keBarisTampil } from "@/lib/biaya";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { hitungMargin, rupiah } from "@/lib/uang";

import { hapusBiayaPenawaran, simpanBiayaPenawaran } from "./actions";

export const metadata: Metadata = { title: "Perkiraan biaya & margin" };
export const dynamic = "force-dynamic";

export default async function HalamanMarginPenawaran({
  params,
}: PageProps<"/penawaran/[id]/margin">) {
  const sesi = await wajibPeran("finance");

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
    subtotalInvoice: penawaran.subtotal.toString(),
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

      <section className="mb-6 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        <Angka label="Penjualan bersih" nilai={rupiah(hasil.net_sales)} />
        <Angka label="Perkiraan biaya" nilai={rupiah(hasil.total_cost)} />
        <Angka
          label={hasil.profit_status === "untung" ? "Perkiraan untung" : "Perkiraan rugi"}
          nilai={rupiah(hasil.profit.abs())}
          menonjol
          rugi={hasil.profit_status === "rugi"}
        />
        <Angka
          label="Margin"
          nilai={`${hasil.margin_percent.toString().replace(".", ",")}%`}
          rugi={hasil.profit_status === "rugi"}
        />
      </section>

      <p className="mb-6 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
        Angka di sini <strong>perkiraan</strong>, dipakai untuk menimbang harga sebelum
        penawaran dikirim. Penjualan bersih diambil dari subtotal
        ({rupiah(penawaran.subtotal)}), bukan dari total penawaran
        ({rupiah(penawaran.grand_total)}) — service charge dan PB1 bukan pendapatan.
        Saat penawaran ini dijadikan tagihan, seluruh baris biaya di bawah ikut tersalin,
        lalu di sana diperbarui menjadi angka yang sebenarnya.
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

function Angka({
  label,
  nilai,
  menonjol,
  rugi,
}: {
  label: string;
  nilai: string;
  menonjol?: boolean;
  rugi?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`angka mt-1 tabular-nums ${menonjol ? "text-lg font-semibold" : "text-base font-medium"} ${rugi ? "text-destructive" : ""}`}
      >
        {nilai}
      </p>
    </div>
  );
}
