import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Calculator, FileSpreadsheet, PencilLine, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Halaman } from "@/components/halaman";
import { StatusPenawaran } from "@/components/lencana-status";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

import { AksiStatusPenawaran } from "./aksi-status";
import { romawi, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Detail quotation" };
export const dynamic = "force-dynamic";

export default async function HalamanDetailPenawaran({
  params,
}: PageProps<"/penawaran/[id]">) {
  const sesi = await wajibPeran("sales", "finance");

  // Margin memperlihatkan biaya dan untung-rugi, jadi hanya untuk yang memang
  // mengurus uang. Sales melihat penawarannya, bukan marginnya.
  const bolehLihatMargin = sesi.peran === "admin" || sesi.peran === "finance";

  const { id } = await params;

  const p = await prisma.quotations.findUnique({
    where: { id: BigInt(id) },
    include: {
      customers: true,
      // Di skema, satu penawaran bisa punya banyak tagihan. Dalam praktiknya
      // hanya satu, jadi cukup ambil yang pertama.
      invoices: { take: 1, select: { id: true, invoice_number: true } },
      quotation_items: {
        where: { parent_id: null },
        orderBy: { id: "asc" },
        include: {
          other_quotation_items: { orderBy: { id: "asc" }, select: { id: true, item_name: true } },
        },
      },
    },
  });

  if (!p) notFound();

  const tagihan = p.invoices[0] ?? null;

  const acara = [
    ["Jenis acara", p.event_type],
    ["Tanggal acara", p.event_date ? format(p.event_date, "d MMMM yyyy", { locale: localeId }) : null],
    ["Jumlah hari", p.event_days ? `${p.event_days} hari` : null],
    ["Jam", p.event_time],
    ["Jumlah tamu", p.guest_count ? `${p.guest_count} orang` : null],
    ["Venue", p.venue],
    ["F&B planner", p.fnb_planner],
  ].filter(([, nilai]) => Boolean(nilai)) as [string, string][];

  return (
    <Halaman>
      <div className="pb-5">
        <Link
          href="/penawaran"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Semua quotation
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="nomor-dokumen text-lg font-semibold">{p.quotation_number}</h1>
            <StatusPenawaran status={p.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {format(p.quotation_date, "d MMMM yyyy", { locale: localeId })} · berlaku sampai{" "}
            {format(p.valid_until, "d MMMM yyyy", { locale: localeId })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/penawaran/${p.id}/cetak`} target="_blank" rel="noopener" />}
          >
            <Printer className="size-4" />
            Cetak
          </Button>
          {p.status !== "approved" ? (
            <Button variant="outline" size="sm" render={<Link href={`/penawaran/${p.id}/ubah`} />}>
              <PencilLine className="size-4" />
              Ubah
            </Button>
          ) : null}
          {bolehLihatMargin ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/penawaran/${p.id}/margin`} />}
            >
              <Calculator className="size-4" />
              Perkiraan biaya
            </Button>
          ) : null}
          <AksiStatusPenawaran
            id={p.id.toString()}
            nomor={p.quotation_number}
            status={p.status}
          />
          {p.status === "approved" && !tagihan ? (
            <Button size="sm" render={<Link href={`/tagihan/baru?dari=${p.id}`} />}>
              <FileSpreadsheet className="size-4" />
              Buat tagihan
            </Button>
          ) : null}
        </div>
      </header>

      {tagihan ? (
        <p className="mb-6 rounded-md border bg-muted/40 px-3.5 py-3 text-sm">
          Penawaran ini sudah dijadikan tagihan{" "}
          <Link
            href={`/tagihan/${tagihan.id}`}
            className="nomor-dokumen underline underline-offset-4"
          >
            {tagihan.invoice_number}
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
                  {p.quotation_items.map((b, i) => (
                    <tr key={b.id.toString()} className="border-b last:border-0 align-top">
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
                        {b.other_quotation_items.length > 0 ? (
                          <ul className="mt-1.5 flex flex-col gap-0.5 border-l pl-3 text-xs text-muted-foreground">
                            {b.other_quotation_items.map((a) => (
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
              <BarisTotal label="Subtotal" nilai={rupiah(p.subtotal)} />
              {Number(p.service_charge_amount) > 0 ? (
                <BarisTotal
                  label={`Service charge ${Number(p.service_charge_percent)}%`}
                  nilai={rupiah(p.service_charge_amount)}
                />
              ) : null}
              {p.pb1_enabled && Number(p.pb1_amount) > 0 ? (
                <BarisTotal
                  label={`PB1 ${Number(p.pb1_percent)}%`}
                  nilai={rupiah(p.pb1_amount)}
                />
              ) : null}
              <div className="mt-1.5 flex items-baseline justify-between border-t pt-2.5">
                <dt className="font-medium">Total quotation</dt>
                <dd className="angka text-base font-semibold tabular-nums">
                  {rupiah(p.grand_total)}
                </dd>
              </div>
            </dl>
          </div>

          {p.show_payment_terms && p.payment_terms ? (
            <Kotak judul="Syarat pembayaran" className="mt-6">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {p.payment_terms}
              </p>
            </Kotak>
          ) : null}

          {p.notes ? (
            <Kotak judul="Catatan" className="mt-6">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.notes}</p>
            </Kotak>
          ) : null}
        </section>

        <aside className="flex flex-col gap-6">
          <Kotak judul="Customer">
            <p className="text-sm font-medium">{p.customers.name}</p>
            <p className="nomor-dokumen text-muted-foreground">{p.customers.customer_code}</p>
            {p.customers.address ? (
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                {p.customers.address}
              </p>
            ) : null}
            {p.contact_person || p.contact_phone ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {p.contact_person}
                {p.contact_person && p.contact_phone ? " · " : ""}
                {p.contact_phone}
              </p>
            ) : null}
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
