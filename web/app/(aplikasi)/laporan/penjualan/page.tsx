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
import { KartuAngka, PapanAngka } from "@/components/kartu-angka";
import { StatusTagihan } from "@/components/lencana-status";
import { Button } from "@/components/ui/button";
import { KepalaTabel, Th } from "@/components/tabel";
import { ringkasTanggalAcaraPendek } from "@/lib/tanggal";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

import { ambilLaporan, bacaSaring } from "@/lib/laporan-penjualan";
import { SaringLaporan } from "./saring";

export const metadata: Metadata = { title: "Laporan penjualan" };
export const dynamic = "force-dynamic";

export default async function HalamanLaporanPenjualan({
  searchParams,
}: PageProps<"/laporan/penjualan">) {
  const sesi = await wajibIzin("laporan-penjualan");

  const params = await searchParams;
  const saring = bacaSaring(params);
  const { baris, pelanggan, ringkasan } = await ambilLaporan(saring, hanyaMiliknya(sesi));

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

      <PapanAngka className="mb-4">
        <KartuAngka
          label="Penjualan diakui"
          warna="hijau"
          nilai={rupiah(ringkasan.penjualanDiakui)}
          keterangan={`dari ${ringkasan.jumlahTagihan} invoice senilai ${rupiah(ringkasan.nilaiTagihan)}`}
          menonjol
        />
        <KartuAngka
          label="Diterima di muka"
          nilai={rupiah(ringkasan.diterimaDiMuka)}
          keterangan="sudah dibayar, acaranya belum terjadi"
          warna="biru"
        />
        <KartuAngka
          label="Proyeksi penjualan"
          nilai={rupiah(ringkasan.proyeksiPenjualan)}
          keterangan="belum dibayar, acaranya belum terjadi"
          warna="oranye"
        />
        <KartuAngka
          label="Piutang"
          nilai={rupiah(ringkasan.totalPiutang)}
          keterangan={
            ringkasan.jumlahJatuhTempo > 0
              ? `${ringkasan.jumlahJatuhTempo} lewat tempo`
              : "belum ada yang lewat tempo"
          }
          warna="kuning"
        />
        <KartuAngka
          label="Quotation"
          warna="ungu"
          nilai={rupiah(ringkasan.nilaiPenawaran)}
          keterangan={`${ringkasan.jumlahPenawaran} dibuat · ${ringkasan.penawaranDisetujui} disetujui`}
        />
      </PapanAngka>

      <BingkaiTabel>
        {baris.length === 0 ? (
          <KeadaanKosong
            judul="Tidak ada invoice pada rentang ini"
            keterangan="Ubah rentang tanggal atau pilih customer yang lain."
          />
        ) : (
          <table className="w-full text-sm">
            <KepalaTabel>
              <Th className="w-36">Nomor</Th>
              <Th className="hidden w-28 md:table-cell">Tanggal</Th>
              <Th>Customer</Th>
              <Th className="w-36 text-right">Nilai</Th>
              <Th className="hidden w-36 text-right lg:table-cell">Terbayar</Th>
              <Th className="w-36 text-right">Sisa</Th>
              <Th className="w-32">Status</Th>
            </KepalaTabel>
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
                  <Td className="hidden text-muted-foreground md:table-cell whitespace-nowrap">
                    {format(b.tanggal, "d MMM yy", { locale: localeId })}
                  </Td>
                  <Td>
                    <span className="font-medium">{b.pelanggan}</span>
                    {keterangan(b.acara, ringkasTanggalAcaraPendek(b.tanggalAcara)) ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {keterangan(b.acara, ringkasTanggalAcaraPendek(b.tanggalAcara))}
                      </span>
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

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}

/** Jenis acara dan tanggalnya, dirangkai dan dibuang yang kosong. */
function keterangan(acara: string | null, tanggal: string | null): string | null {
  const bagian = [acara, tanggal].filter((x) => x && x.trim() !== "");
  return bagian.length > 0 ? bagian.join(" · ") : null;
}
