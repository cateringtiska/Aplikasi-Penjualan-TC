import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Halaman } from "@/components/halaman";
import { StatusTagihan } from "@/components/lencana-status";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { d, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Detail pembayaran" };
export const dynamic = "force-dynamic";

const LABEL_METODE: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer bank",
  giro: "Giro",
  lainnya: "Lainnya",
};

export default async function HalamanDetailPembayaran({
  params,
}: PageProps<"/pembayaran/[id]">) {
  await wajibPeran("finance");

  const { id } = await params;

  const p = await prisma.payments.findUnique({
    where: { id: BigInt(id) },
    include: {
      customers: true,
      users: { select: { name: true } },
      payment_details: {
        orderBy: { id: "asc" },
        include: {
          invoices: {
            select: {
              id: true,
              invoice_number: true,
              due_date: true,
              grand_total: true,
              paid_amount: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!p) notFound();

  return (
    <Halaman>
      <div className="pb-5">
        <Link
          href="/pembayaran"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Semua pembayaran
        </Link>
      </div>

      <header className="pb-6">
        <h1 className="nomor-dokumen text-lg font-semibold">{p.payment_number}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {format(p.payment_date, "d MMMM yyyy", { locale: localeId })} ·{" "}
          {LABEL_METODE[p.payment_method] ?? p.payment_method}
          {p.bank_cash ? ` · ${p.bank_cash}` : ""}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-1 divide-border rounded-lg border bg-card sm:grid-cols-3 sm:divide-x">
        <Angka label="Uang diterima" nilai={rupiah(p.total_amount)} menonjol />
        <Angka label="Dari customer" nilai={p.customers.name} teks />
        <Angka
          label="Menutup"
          nilai={`${p.payment_details.length} tagihan`}
          teks
          keterangan={p.users ? `Dicatat oleh ${p.users.name}` : undefined}
        />
      </section>

      <section>
        <h2 className="pb-2.5 text-sm font-semibold tracking-[-0.01em]">Alokasi ke invoice</h2>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th>Invoice</Th>
                  <Th className="hidden w-32 md:table-cell">Jatuh tempo</Th>
                  <Th className="w-36 text-right">Nilai invoice</Th>
                  <Th className="w-36 text-right">Dialokasikan</Th>
                  <Th className="w-32">Status kini</Th>
                </tr>
              </thead>
              <tbody>
                {p.payment_details.map((baris) => (
                  <tr key={baris.id.toString()} className="border-b last:border-0">
                    <Td>
                      <Link
                        href={`/tagihan/${baris.invoices.id}`}
                        className="nomor-dokumen underline-offset-4 hover:underline"
                      >
                        {baris.invoices.invoice_number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        sisa sekarang{" "}
                        {rupiah(d(baris.invoices.grand_total).minus(d(baris.invoices.paid_amount)))}
                      </span>
                    </Td>
                    <Td className="hidden text-muted-foreground md:table-cell">
                      {format(baris.invoices.due_date, "d MMM yyyy", { locale: localeId })}
                    </Td>
                    <Td className="angka text-right tabular-nums text-muted-foreground">
                      {rupiah(baris.invoices.grand_total)}
                    </Td>
                    <Td className="angka text-right font-medium tabular-nums">
                      {rupiah(baris.amount_applied)}
                    </Td>
                    <Td>
                      <StatusTagihan status={baris.invoices.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {p.notes ? (
        <section className="mt-6 rounded-lg border bg-card p-4">
          <h2 className="eyebrow pb-2.5">Catatan</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.notes}</p>
        </section>
      ) : null}
    </Halaman>
  );
}

function Angka({
  label,
  nilai,
  keterangan,
  menonjol,
  teks,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  menonjol?: boolean;
  teks?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-1.5 font-semibold tracking-[-0.02em] ${
          menonjol ? "text-[1.375rem]" : "text-base"
        } ${teks ? "" : "angka tabular-nums"}`}
      >
        {nilai}
      </p>
      {keterangan ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
      ) : null}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground uppercase ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
