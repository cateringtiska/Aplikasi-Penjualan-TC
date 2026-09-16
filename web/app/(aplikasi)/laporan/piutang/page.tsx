import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { Pencarian } from "@/components/pencarian";
import { Button } from "@/components/ui/button";
import { ambilPiutang, KELOMPOK } from "@/lib/laporan-piutang";
import { wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Kartu piutang" };
export const dynamic = "force-dynamic";

export default async function HalamanPiutang({ searchParams }: PageProps<"/laporan/piutang">) {
  await wajibPeran("sales", "finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const { daftar, umur, totalSemua } = await ambilPiutang(kunci);

  return (
    <Halaman>
      <KepalaHalaman
        judul="Kartu piutang"
        keterangan="Sisa invoice per customer, dikelompokkan menurut umur keterlambatannya."
        aksi={
          <Button variant="outline" size="sm" render={<a href={`/laporan/piutang/excel${kunci ? `?cari=${encodeURIComponent(kunci)}` : ""}`} />}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
        }
      />

      <section className="mb-6 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        {KELOMPOK.map((k) => (
          <div key={k.kunci} className="px-4 py-4 sm:px-5">
            <p className="eyebrow">{k.label}</p>
            <p
              className={`angka mt-1.5 text-lg font-semibold tracking-[-0.025em] tabular-nums ${
                k.kunci === "h60" && umur.h60.gt(0) ? "text-tempo" : ""
              }`}
            >
              {rupiah(umur[k.kunci])}
            </p>
          </div>
        ))}
      </section>

      <div className="pb-4">
        <Pencarian placeholder="Cari nama customer…" />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Tidak ada piutang"}
            keterangan={
              kunci
                ? `Tidak ditemukan piutang atas nama "${kunci}".`
                : "Semua invoice sudah lunas. Tidak ada yang perlu ditagih."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Customer</Th>
                <Th className="hidden w-28 sm:table-cell">Invoice</Th>
                <Th className="hidden w-40 md:table-cell">Jatuh tempo tertua</Th>
                <Th className="w-32 text-right">Terlambat</Th>
                <Th className="w-40 text-right">Sisa piutang</Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.idPelanggan} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/pelanggan/${p.idPelanggan}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.nama}
                    </Link>
                    <span className="nomor-dokumen block text-muted-foreground">{p.kode}</span>
                  </Td>
                  <Td className="hidden text-muted-foreground sm:table-cell">
                    {p.jumlahTagihan} lembar
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {format(p.tempoTertua, "d MMM yyyy", { locale: localeId })}
                  </Td>
                  <Td className="angka text-right tabular-nums">
                    {p.hariTerlambat > 0 ? (
                      <span className={p.hariTerlambat > 60 ? "font-medium text-tempo" : ""}>
                        {p.hariTerlambat} hari
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="angka text-right font-medium tabular-nums">
                    {rupiah(p.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} pelanggan · total piutang {rupiah(totalSemua)}
        </RingkasanTabel>
      ) : null}
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
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
