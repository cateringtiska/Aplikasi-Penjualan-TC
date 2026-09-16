import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { FileSpreadsheet, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { StatusTagihan } from "@/components/lencana-status";
import { Button } from "@/components/ui/button";
import { wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

import { ambilLaporan, bacaSaring } from "@/lib/laporan-penjualan";
import { SaringLaporan } from "./saring";

export const metadata: Metadata = { title: "Laporan penjualan" };
export const dynamic = "force-dynamic";

export default async function HalamanLaporanPenjualan({
  searchParams,
}: PageProps<"/laporan/penjualan">) {
  await wajibPeran("sales", "finance");

  const params = await searchParams;
  const saring = bacaSaring(params);
  const { baris, pelanggan, ringkasan } = await ambilLaporan(saring);

  const kueri = new URLSearchParams(
    Object.entries(saring).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <Halaman>
      <KepalaHalaman
        judul="Laporan penjualan"
        keterangan="Rekap quotation dan invoice pada rentang tanggal yang dipilih."
        aksi={
          <>
            <Button
              variant="outline"
              size="sm"
              render={<a href={`/laporan/penjualan/excel?${kueri}`} />}
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={
                <a href={`/laporan/penjualan/cetak?${kueri}`} target="_blank" rel="noopener" />
              }
            >
              <Printer className="size-4" />
              Cetak
            </Button>
          </>
        }
      />

      <div className="pb-5">
        <SaringLaporan pelanggan={pelanggan} />
      </div>

      <section className="mb-4 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        <Angka
          label="Nilai invoice"
          nilai={rupiah(ringkasan.nilaiTagihan)}
          keterangan={`${ringkasan.jumlahTagihan} invoice`}
          menonjol
        />
        <Angka
          label="Sudah dibayar"
          nilai={rupiah(ringkasan.totalTerbayar)}
          keterangan="uang yang sudah masuk"
        />
        <Angka
          label="Piutang"
          nilai={rupiah(ringkasan.totalPiutang)}
          keterangan={`${ringkasan.jumlahJatuhTempo} lewat tempo`}
          peringatan={ringkasan.jumlahJatuhTempo > 0}
        />
        <Angka
          label="Quotation"
          nilai={rupiah(ringkasan.nilaiPenawaran)}
          keterangan={`${ringkasan.jumlahPenawaran} dibuat · ${ringkasan.penawaranDisetujui} disetujui`}
        />
      </section>

      <BingkaiTabel>
        {baris.length === 0 ? (
          <KeadaanKosong
            judul="Tidak ada invoice pada rentang ini"
            keterangan="Ubah rentang tanggal atau pilih customer yang lain."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-36">Nomor</Th>
                <Th className="hidden w-28 md:table-cell">Tanggal</Th>
                <Th>Customer</Th>
                <Th className="w-36 text-right">Nilai</Th>
                <Th className="hidden w-36 text-right lg:table-cell">Terbayar</Th>
                <Th className="w-36 text-right">Sisa</Th>
                <Th className="w-32">Status</Th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/tagihan/${b.id}`}
                      className="nomor-dokumen underline-offset-4 hover:underline"
                    >
                      {b.nomor}
                    </Link>
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {format(b.tanggal, "d MMM yy", { locale: localeId })}
                  </Td>
                  <Td>
                    <span className="font-medium">{b.pelanggan}</span>
                    {b.acara ? (
                      <span className="block text-xs text-muted-foreground">{b.acara}</span>
                    ) : null}
                  </Td>
                  <Td className="angka text-right tabular-nums">{rupiah(b.total)}</Td>
                  <Td className="angka hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                    {rupiah(b.dibayar)}
                  </Td>
                  <Td className="angka text-right font-medium tabular-nums">
                    {b.status === "cancelled" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      rupiah(b.sisa)
                    )}
                  </Td>
                  <Td>
                    <StatusTagihan status={b.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {baris.length > 0 ? (
        <RingkasanTabel>
          {baris.length} baris ditampilkan · tagihan dibatalkan tidak dihitung dalam ringkasan
        </RingkasanTabel>
      ) : null}
    </Halaman>
  );
}

function Angka({
  label,
  nilai,
  keterangan,
  menonjol,
  peringatan,
}: {
  label: string;
  nilai: string;
  keterangan: string;
  menonjol?: boolean;
  peringatan?: boolean;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`angka mt-1.5 font-semibold tracking-[-0.025em] tabular-nums ${
          menonjol ? "text-[1.375rem]" : "text-lg"
        } ${peringatan ? "text-tempo" : ""}`}
      >
        {nilai}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
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
