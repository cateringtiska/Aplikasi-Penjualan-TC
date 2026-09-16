import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { FileSpreadsheet, Lock } from "lucide-react";
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
import { ambilLaporanMargin } from "@/lib/laporan-margin";
import { wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Laporan margin" };
export const dynamic = "force-dynamic";

export default async function HalamanLaporanMargin({
  searchParams,
}: PageProps<"/laporan/margin">) {
  await wajibPeran("finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const { nyata, perkiraan, ringkasanNyata, ringkasanPerkiraan } =
    await ambilLaporanMargin(kunci);

  return (
    <Halaman>
      <KepalaHalaman
        judul="Laporan margin"
        keterangan="Margin per acara. Angka nyata dari invoice dan angka perkiraan dari quotation dipisah, tidak pernah dijumlahkan."
        aksi={
          <Button variant="outline" size="sm" render={<a href={`/laporan/margin/excel${kunci ? `?cari=${encodeURIComponent(kunci)}` : ""}`} />}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
        }
      />

      <div className="pb-6">
        <Pencarian placeholder="Cari nomor dokumen atau customer…" />
      </div>

      <h2 className="text-sm font-semibold tracking-[-0.01em]">Nyata · dari invoice</h2>
      <p className="pb-2.5 text-xs text-muted-foreground">
        Uang yang sudah benar-benar ditagihkan, dikurangi biaya yang sudah dicatat.
      </p>

      <section className="mb-4 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        <Angka label="Penjualan bersih" nilai={rupiah(ringkasanNyata.penjualan)} />
        <Angka label="Total biaya" nilai={rupiah(ringkasanNyata.biaya)} />
        <Angka
          label={ringkasanNyata.untung.isNegative() ? "Rugi" : "Margin"}
          nilai={rupiah(ringkasanNyata.untung.abs())}
          menonjol
          rugi={ringkasanNyata.untung.isNegative()}
        />
        <Angka
          label="Margin rata-rata"
          nilai={`${ringkasanNyata.marginPersen.toString().replace(".", ",")}%`}
          rugi={ringkasanNyata.marginPersen.isNegative()}
        />
      </section>

      {ringkasanNyata.belumDicatat > 0 ? (
        <p className="mb-4 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
          {ringkasanNyata.belumDicatat} invoice belum punya catatan biaya sama sekali, jadi seluruh nilainya
          terhitung sebagai margin. Angka di atas baru bisa dipercaya setelah biayanya dicatat.
        </p>
      ) : null}

      <BingkaiTabel>
        {nyata.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Belum ada invoice"}
            keterangan="Margin dihitung per invoice, jadi buat invoice lebih dulu."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-36">Invoice</Th>
                <Th>Customer</Th>
                <Th className="hidden w-36 text-right lg:table-cell">Penjualan</Th>
                <Th className="w-36 text-right">Biaya</Th>
                <Th className="w-36 text-right">Margin</Th>
                <Th className="w-24 text-right">Margin %</Th>
              </tr>
            </thead>
            <tbody>
              {nyata.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/tagihan/${b.id}/margin`}
                      className="nomor-dokumen underline-offset-4 hover:underline"
                    >
                      {b.nomor}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {format(b.tanggal, "d MMM yy", { locale: localeId })}
                      {b.final ? " · final" : ""}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium">{b.pelanggan}</span>
                    {b.jenisAcara ? (
                      <span className="block text-xs text-muted-foreground">{b.jenisAcara}</span>
                    ) : null}
                  </Td>
                  <Td className="angka hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                    {rupiah(b.penjualan)}
                  </Td>
                  <Td className="angka text-right tabular-nums text-muted-foreground">
                    {b.adaBiaya ? rupiah(b.biaya) : <span className="text-xs">belum dicatat</span>}
                  </Td>
                  <Td
                    className={`angka text-right font-medium tabular-nums ${b.rugi ? "text-tempo" : ""}`}
                  >
                    {rupiah(b.untung)}
                  </Td>
                  <Td className={`angka text-right tabular-nums ${b.rugi ? "text-tempo" : ""}`}>
                    <span className="inline-flex items-center gap-1">
                      {b.final ? (
                        <Lock className="size-3 text-muted-foreground" aria-label="final" />
                      ) : null}
                      {b.marginPersen.toString().replace(".", ",")}%
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {nyata.length > 0 ? (
        <RingkasanTabel>
          {nyata.length} invoice · invoice yang dibatalkan tidak dihitung
        </RingkasanTabel>
      ) : null}

      {perkiraan.length > 0 ? (
        <section className="pt-8">
          <h2 className="pb-1 text-sm font-semibold tracking-[-0.01em]">
            Perkiraan · dari quotation
          </h2>
          <p className="pb-2.5 text-xs text-muted-foreground">
            Quotation yang belum jadi invoice, memakai perkiraan biaya yang dicatat di
            penawarannya. Dipakai menimbang harga sebelum dikirim ke klien.
          </p>

          <section className="mb-4 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
            <Angka label="Penjualan bersih" nilai={rupiah(ringkasanPerkiraan.penjualan)} />
            <Angka label="Perkiraan biaya" nilai={rupiah(ringkasanPerkiraan.biaya)} />
            <Angka
              label={ringkasanPerkiraan.untung.isNegative() ? "Perkiraan rugi" : "Perkiraan margin"}
              nilai={rupiah(ringkasanPerkiraan.untung.abs())}
              menonjol
              rugi={ringkasanPerkiraan.untung.isNegative()}
            />
            <Angka
              label="Margin rata-rata"
              nilai={`${ringkasanPerkiraan.marginPersen.toString().replace(".", ",")}%`}
              rugi={ringkasanPerkiraan.marginPersen.isNegative()}
            />
          </section>

          {ringkasanPerkiraan.belumDicatat > 0 ? (
            <p className="mb-4 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
              {ringkasanPerkiraan.belumDicatat} quotation belum punya perkiraan biaya, jadi seluruh
              nilainya terhitung sebagai margin.
            </p>
          ) : null}

          <BingkaiTabel>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th className="w-36">Quotation</Th>
                  <Th>Customer</Th>
                  <Th className="hidden w-36 text-right lg:table-cell">Penjualan</Th>
                  <Th className="w-36 text-right">Perkiraan biaya</Th>
                  <Th className="w-36 text-right">Perkiraan margin</Th>
                  <Th className="w-24 text-right">Margin %</Th>
                </tr>
              </thead>
              <tbody>
                {perkiraan.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/25">
                    <Td>
                      <Link
                        href={`/penawaran/${b.id}/margin`}
                        className="nomor-dokumen underline-offset-4 hover:underline"
                      >
                        {b.nomor}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {format(b.tanggal, "d MMM yy", { locale: localeId })}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-medium">{b.pelanggan}</span>
                      {b.jenisAcara ? (
                        <span className="block text-xs text-muted-foreground">{b.jenisAcara}</span>
                      ) : null}
                    </Td>
                    <Td className="angka hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                      {rupiah(b.hasil.net_sales)}
                    </Td>
                    <Td className="angka text-right tabular-nums text-muted-foreground">
                      {b.adaBiaya ? (
                        rupiah(b.hasil.total_cost)
                      ) : (
                        <span className="text-xs">belum dicatat</span>
                      )}
                    </Td>
                    <Td
                      className={`angka text-right font-medium tabular-nums ${b.hasil.profit_status === "rugi" ? "text-tempo" : ""}`}
                    >
                      {rupiah(b.hasil.profit.abs())}
                    </Td>
                    <Td
                      className={`angka text-right tabular-nums ${b.hasil.profit_status === "rugi" ? "text-tempo" : ""}`}
                    >
                      {b.hasil.margin_percent.toString().replace(".", ",")}%
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BingkaiTabel>

          <RingkasanTabel>
            {perkiraan.length} quotation · yang sudah jadi invoice tidak dihitung dua kali
          </RingkasanTabel>
        </section>
      ) : null}
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
