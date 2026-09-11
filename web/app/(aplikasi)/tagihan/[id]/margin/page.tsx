import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Halaman } from "@/components/halaman";
import { PanelBiaya } from "@/components/panel-biaya";
import { keBarisTampil } from "@/lib/biaya";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { hitungMargin, rupiah } from "@/lib/uang";

import { bukaKembaliMargin, finalisasiMargin, hapusBiaya, simpanBiaya } from "./actions";

export const metadata: Metadata = { title: "Biaya & margin" };
export const dynamic = "force-dynamic";

export default async function HalamanMargin({ params }: PageProps<"/tagihan/[id]/margin">) {
  const sesi = await wajibPeran("finance");

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
    subtotalInvoice: tagihan.subtotal.toString(),
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

      <section className="mb-6 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        <Angka label="Penjualan bersih" nilai={rupiah(hasil.net_sales)} />
        <Angka label="Total biaya" nilai={rupiah(hasil.total_cost)} />
        <Angka
          label={hasil.profit_status === "untung" ? "Untung" : "Rugi"}
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
        Penjualan bersih diambil dari <strong>subtotal</strong> tagihan
        ({rupiah(tagihan.subtotal)}), bukan dari total tagihan
        ({rupiah(tagihan.grand_total)}). Service charge dan PB1 tidak dihitung sebagai
        pendapatan — PB1 adalah pajak yang diteruskan ke pemerintah.
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
    <div className="px-4 py-4 sm:px-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`angka mt-1.5 font-semibold tracking-[-0.025em] tabular-nums ${
          menonjol ? "text-[1.375rem]" : "text-lg"
        } ${rugi ? "text-tempo" : ""}`}
      >
        {nilai}
      </p>
    </div>
  );
}
