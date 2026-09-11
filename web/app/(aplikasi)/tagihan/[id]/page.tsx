import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Calculator, PencilLine, Printer, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Halaman } from "@/components/halaman";
import { StatusTagihan } from "@/components/lencana-status";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { d, labelStatusInvoice, romawi, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Detail tagihan" };
export const dynamic = "force-dynamic";

export default async function HalamanDetailTagihan({ params }: PageProps<"/tagihan/[id]">) {
  const sesi = await wajibPeran("sales", "finance");

  const { id } = await params;

  const t = await prisma.invoices.findUnique({
    where: { id: BigInt(id) },
    include: {
      customers: true,
      quotations: { select: { id: true, quotation_number: true } },
      payment_details: {
        orderBy: { id: "desc" },
        include: {
          payments: {
            select: {
              id: true,
              payment_number: true,
              payment_date: true,
              payment_method: true,
            },
          },
        },
      },
      invoice_items: {
        where: { parent_id: null },
        orderBy: { id: "asc" },
        include: {
          other_invoice_items: { orderBy: { id: "asc" }, select: { id: true, item_name: true } },
        },
      },
    },
  });

  if (!t) notFound();

  const sisa = d(t.grand_total).minus(d(t.paid_amount));
  const bolehKelolaUang = sesi.peran === "admin" || sesi.peran === "finance";
  const belumLunas = ["unpaid", "partial", "overdue"].includes(t.status);

  const acara = [
    ["Jenis acara", t.event_type],
    ["Tanggal acara", t.event_date ? format(t.event_date, "d MMMM yyyy", { locale: localeId }) : null],
    ["Jumlah hari", t.event_days ? `${t.event_days} hari` : null],
    ["Jam", t.event_time],
    ["Jumlah tamu", t.guest_count ? `${t.guest_count} orang` : null],
    ["Venue", t.venue],
    ["F&B planner", t.fnb_planner],
  ].filter(([, nilai]) => Boolean(nilai)) as [string, string][];

  return (
    <Halaman>
      <div className="pb-5">
        <Link
          href="/tagihan"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Semua tagihan
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="nomor-dokumen text-lg font-semibold">{t.invoice_number}</h1>
            <StatusTagihan status={t.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {format(t.invoice_date, "d MMMM yyyy", { locale: localeId })} · jatuh tempo{" "}
            {format(t.due_date, "d MMMM yyyy", { locale: localeId })}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/tagihan/${t.id}/cetak`} target="_blank" rel="noopener" />}
          >
            <Printer className="size-4" />
            Cetak
          </Button>
          {Number(t.paid_amount) === 0 && t.status !== "cancelled" ? (
            <Button variant="outline" size="sm" render={<Link href={`/tagihan/${t.id}/ubah`} />}>
              <PencilLine className="size-4" />
              Ubah
            </Button>
          ) : null}
          {bolehKelolaUang ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/tagihan/${t.id}/margin`} />}
            >
              <Calculator className="size-4" />
              Biaya &amp; margin
            </Button>
          ) : null}
          {bolehKelolaUang && belumLunas ? (
            <Button size="sm" render={<Link href={`/pembayaran/baru?tagihan=${t.id}`} />}>
              <Wallet className="size-4" />
              Catat pembayaran
            </Button>
          ) : null}
        </div>
      </header>

      {/* Ringkasan uang — bagian yang paling sering dicari orang di halaman ini */}
      <section className="mb-6 grid grid-cols-1 divide-border rounded-lg border bg-card sm:grid-cols-3 sm:divide-x">
        <AngkaBesar label="Nilai tagihan" nilai={rupiah(t.grand_total)} />
        <AngkaBesar label="Sudah dibayar" nilai={rupiah(t.paid_amount)} />
        <AngkaBesar
          label="Sisa"
          nilai={rupiah(sisa)}
          menonjol
          peringatan={t.status === "overdue" && sisa.gt(0)}
          keterangan={labelStatusInvoice(t.status, t.paid_amount.toString())}
        />
      </section>

      {t.quotations ? (
        <p className="mb-6 rounded-md border bg-muted/40 px-3.5 py-3 text-sm">
          Dibuat dari penawaran{" "}
          <Link
            href={`/penawaran/${t.quotations.id}`}
            className="nomor-dokumen underline underline-offset-4"
          >
            {t.quotations.quotation_number}
          </Link>
          .
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <Th className="w-12">No</Th>
                    <Th>Uraian</Th>
                    <Th className="w-24 text-right">Jumlah</Th>
                    <Th className="w-32 text-right">Harga</Th>
                    <Th className="w-36 text-right">Nilai</Th>
                  </tr>
                </thead>
                <tbody>
                  {t.invoice_items.map((b, i) => (
                    <tr key={b.id.toString()} className="border-b align-top last:border-0">
                      <Td className="nomor-dokumen text-muted-foreground">{romawi(i + 1)}</Td>
                      <Td>
                        <span className="font-medium">{b.item_name}</span>
                        {b.is_compliment ? (
                          <span className="ml-2 text-xs text-muted-foreground">(compliment)</span>
                        ) : null}
                        {!b.charge_service ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (tanpa service charge)
                          </span>
                        ) : null}
                        {b.other_invoice_items.length > 0 ? (
                          <ul className="mt-1.5 flex flex-col gap-0.5 border-l pl-3 text-xs text-muted-foreground">
                            {b.other_invoice_items.map((a) => (
                              <li key={a.id.toString()}>{a.item_name}</li>
                            ))}
                          </ul>
                        ) : null}
                      </Td>
                      <Td className="angka text-right tabular-nums text-muted-foreground">
                        {Number(b.qty).toLocaleString("id-ID")} {b.unit ?? ""}
                      </Td>
                      <Td className="angka text-right tabular-nums text-muted-foreground">
                        {rupiah(b.price)}
                      </Td>
                      <Td className="angka text-right font-medium tabular-nums">
                        {b.is_compliment ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          rupiah(b.subtotal)
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="flex flex-col gap-1.5 border-t bg-muted/20 px-4 py-4 text-sm">
              <BarisTotal label="Subtotal" nilai={rupiah(t.subtotal)} />
              {Number(t.service_charge_amount) > 0 ? (
                <BarisTotal
                  label={`Service charge ${Number(t.service_charge_percent)}%`}
                  nilai={rupiah(t.service_charge_amount)}
                />
              ) : null}
              {t.pb1_enabled && Number(t.pb1_amount) > 0 ? (
                <BarisTotal label={`PB1 ${Number(t.pb1_percent)}%`} nilai={rupiah(t.pb1_amount)} />
              ) : null}
              <div className="mt-1.5 flex items-baseline justify-between border-t pt-2.5">
                <dt className="font-medium">Total tagihan</dt>
                <dd className="angka text-base font-semibold tabular-nums">
                  {rupiah(t.grand_total)}
                </dd>
              </div>
            </dl>
          </div>

          {t.show_payment_terms && t.payment_terms ? (
            <Kotak judul="Syarat pembayaran" className="mt-6">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {t.payment_terms}
              </p>
            </Kotak>
          ) : null}

          {t.notes ? (
            <Kotak judul="Catatan" className="mt-6">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{t.notes}</p>
            </Kotak>
          ) : null}
        </section>

        <aside className="flex flex-col gap-6">
          <Kotak judul="Customer">
            <p className="text-sm font-medium">{t.customers.name}</p>
            <p className="nomor-dokumen text-muted-foreground">{t.customers.customer_code}</p>
            {t.customers.address ? (
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                {t.customers.address}
              </p>
            ) : null}
            {t.contact_person || t.contact_phone ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t.contact_person}
                {t.contact_person && t.contact_phone ? " · " : ""}
                {t.contact_phone}
              </p>
            ) : null}
          </Kotak>

          <Kotak judul="Riwayat pembayaran">
            {t.payment_details.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran masuk.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {t.payment_details.map((p) => (
                  <li key={p.id.toString()} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <Link
                        href={`/pembayaran/${p.payments.id}`}
                        className="nomor-dokumen underline-offset-4 hover:underline"
                      >
                        {p.payments.payment_number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {format(p.payments.payment_date, "d MMM yyyy", { locale: localeId })}
                      </span>
                    </span>
                    <span className="angka shrink-0 text-sm font-medium tabular-nums">
                      {rupiah(p.amount_applied)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Kotak>

          {acara.length > 0 ? (
            <Kotak judul="Detail acara">
              <dl className="flex flex-col gap-2 text-sm">
                {acara.map(([label, nilai]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right">{nilai}</dd>
                  </div>
                ))}
              </dl>
            </Kotak>
          ) : null}
        </aside>
      </div>
    </Halaman>
  );
}

function AngkaBesar({
  label,
  nilai,
  keterangan,
  menonjol,
  peringatan,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  menonjol?: boolean;
  peringatan?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p
        className={`angka mt-1.5 font-semibold tracking-[-0.025em] tabular-nums ${
          menonjol ? "text-[1.375rem]" : "text-lg"
        } ${peringatan ? "text-tempo" : ""}`}
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
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}

function BarisTotal({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="angka tabular-nums">{nilai}</dd>
    </div>
  );
}

function Kotak({
  judul,
  children,
  className,
}: {
  judul: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border bg-card p-4 ${className ?? ""}`}>
      <h2 className="eyebrow pb-2.5">{judul}</h2>
      {children}
    </section>
  );
}
