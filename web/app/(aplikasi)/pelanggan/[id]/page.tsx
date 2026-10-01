import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BingkaiTabel, Halaman, KeadaanKosong } from "@/components/halaman";
import { KartuAngka, PapanAngka } from "@/components/kartu-angka";
import { Button } from "@/components/ui/button";
import { ambilKartuPiutang } from "@/lib/kartu-piutang";
import { wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Kartu piutang customer" };
export const dynamic = "force-dynamic";

export default async function HalamanKartuCustomer({
  params,
}: PageProps<"/pelanggan/[id]">) {
  await wajibPeran("sales", "finance");

  const { id } = await params;
  const kartu = await ambilKartuPiutang(id);
  if (!kartu) notFound();

  const { customer, baris, totalInvoice, totalBayar, sisa } = kartu;
  const lunas = sisa.lte(0);

  return (
    <Halaman>
      <div className="pb-5">
        <Link
          href="/pelanggan"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Semua customer
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">{customer.nama}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="nomor-dokumen">{customer.kode}</span>
            {customer.pic ? ` · ${customer.pic}` : ""}
            {customer.telepon ? ` · ${customer.telepon}` : ""}
          </p>
          {customer.alamat ? (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">{customer.alamat}</p>
          ) : null}
        </div>

        <Button
          variant="outline"
          size="sm"
          render={
            <a href={`/pelanggan/${customer.id}/cetak`} target="_blank" rel="noopener" />
          }
        >
          <Printer className="size-4" />
          Cetak kartu
        </Button>
      </header>

      <PapanAngka kolom={3} className="mb-6">
        <KartuAngka label="Total invoice" warna="biru" nilai={rupiah(totalInvoice)} />
        <KartuAngka
          label="Sudah dibayar"
          nilai={rupiah(totalBayar)}
          warna="hijau"
        />
        <KartuAngka
          label={lunas ? "Lunas" : "Sisa piutang"}
          nilai={rupiah(sisa)}
          menonjol
          warna={lunas ? "ungu" : "kuning"}
        />
      </PapanAngka>

      <h2 className="pb-1 text-sm font-semibold tracking-[-0.01em]">Mutasi</h2>
      <p className="pb-2.5 text-xs text-muted-foreground">
        Seluruh invoice dan pembayaran berurutan waktu, termasuk yang sudah lunas. Invoice
        yang dibatalkan tidak ikut — ia tidak pernah menjadi piutang.
      </p>

      <BingkaiTabel>
        {baris.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada mutasi"
            keterangan="Customer ini belum punya invoice maupun pembayaran."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th className="w-28">Tanggal</Th>
                  <Th className="w-40">Dokumen</Th>
                  <Th>Keterangan</Th>
                  <Th className="w-36 text-right">Invoice</Th>
                  <Th className="w-36 text-right">Bayar</Th>
                  <Th className="w-36 text-right">Saldo</Th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.kunci} className="border-b last:border-0 hover:bg-muted/25">
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {format(b.tanggal, "d MMM yy", { locale: localeId })}
                    </Td>
                    <Td>
                      <Link
                        href={b.tautan}
                        className="nomor-dokumen underline-offset-4 hover:underline"
                      >
                        {b.nomor}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{b.keterangan ?? "—"}</Td>
                    <Td className="angka text-right tabular-nums">
                      {b.debit.gt(0) ? rupiah(b.debit) : "—"}
                    </Td>
                    <Td className="angka text-right tabular-nums">
                      {b.kredit.gt(0) ? rupiah(b.kredit) : "—"}
                    </Td>
                    <Td className="angka text-right font-medium tabular-nums">
                      {rupiah(b.saldo)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <Td className="whitespace-nowrap">SALDO AKHIR</Td>
                  <Td />
                  <Td className="text-xs font-normal text-muted-foreground">
                    {baris.length} mutasi
                  </Td>
                  <Td className="angka text-right tabular-nums">{rupiah(totalInvoice)}</Td>
                  <Td className="angka text-right tabular-nums">{rupiah(totalBayar)}</Td>
                  <Td className={`angka text-right tabular-nums ${lunas ? "" : "text-sebagian"}`}>
                    {rupiah(sisa)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </BingkaiTabel>
    </Halaman>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground uppercase ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
