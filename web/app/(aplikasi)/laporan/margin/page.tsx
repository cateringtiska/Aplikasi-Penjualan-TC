import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Lock } from "lucide-react";
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
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { d, hitungMargin, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Laporan margin" };
export const dynamic = "force-dynamic";

export default async function HalamanLaporanMargin({
  searchParams,
}: PageProps<"/laporan/margin">) {
  await wajibPeran("finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const daftar = await prisma.invoices.findMany({
    where: {
      status: { not: "cancelled" },
      ...(kunci
        ? {
            OR: [
              { invoice_number: { contains: kunci, mode: "insensitive" } },
              { customers: { name: { contains: kunci, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { invoice_date: "desc" },
    select: {
      id: true,
      invoice_number: true,
      invoice_date: true,
      subtotal: true,
      event_type: true,
      customers: { select: { name: true } },
      invoice_margins: {
        select: {
          net_sales: true,
          total_cost: true,
          profit: true,
          margin_percent: true,
          profit_status: true,
          status: true,
        },
      },
      _count: { select: { invoice_costs: true } },
    },
  });

  // Penawaran yang BELUM jadi tagihan. Yang sudah jadi tagihan sengaja
  // ditinggalkan: acaranya sudah punya angka nyata di bagian bawah, dan
  // memunculkannya dua kali membuat totalnya terhitung ganda.
  //
  // Yang ditolak dan yang kadaluarsa juga ditinggalkan — acaranya tidak akan
  // terjadi, jadi perkiraan untungnya tidak berarti apa-apa.
  const penawaran = await prisma.quotations.findMany({
    where: {
      status: { notIn: ["rejected", "expired"] },
      invoices: { none: {} },
      ...(kunci
        ? {
            OR: [
              { quotation_number: { contains: kunci, mode: "insensitive" } },
              { customers: { name: { contains: kunci, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { quotation_date: "desc" },
    select: {
      id: true,
      quotation_number: true,
      quotation_date: true,
      subtotal: true,
      event_type: true,
      status: true,
      customers: { select: { name: true } },
      quotation_costs: { select: { estimated_amount: true, actual_amount: true } },
    },
  });

  const perkiraan = penawaran.map((p) => {
    const hasil = hitungMargin({
      subtotalInvoice: p.subtotal.toString(),
      biaya: p.quotation_costs.map((b) => ({
        estimated_amount: b.estimated_amount?.toString() ?? null,
        actual_amount: b.actual_amount?.toString() ?? null,
      })),
    });
    return { p, hasil, adaBiaya: p.quotation_costs.length > 0 };
  });

  const totalPenjualan = daftar.reduce(
    (j, t) => j.plus(d(t.invoice_margins?.net_sales ?? 0)),
    d(0),
  );
  const totalBiaya = daftar.reduce(
    (j, t) => j.plus(d(t.invoice_margins?.total_cost ?? 0)),
    d(0),
  );
  const totalUntung = totalPenjualan.minus(totalBiaya);
  const marginRata = totalPenjualan.gt(0)
    ? totalUntung.dividedBy(totalPenjualan).times(100).toDecimalPlaces(2)
    : d(0);

  const belumDihitung = daftar.filter((t) => t._count.invoice_costs === 0).length;

  return (
    <Halaman>
      <KepalaHalaman
        judul="Laporan margin"
        keterangan="Untung-rugi per acara, dihitung dari subtotal tagihan dikurangi biayanya."
      />

      <section className="mb-4 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        <Angka label="Penjualan bersih" nilai={rupiah(totalPenjualan)} />
        <Angka label="Total biaya" nilai={rupiah(totalBiaya)} />
        <Angka
          label={totalUntung.isNegative() ? "Rugi" : "Untung"}
          nilai={rupiah(totalUntung.abs())}
          menonjol
          rugi={totalUntung.isNegative()}
        />
        <Angka
          label="Margin rata-rata"
          nilai={`${marginRata.toString().replace(".", ",")}%`}
          rugi={marginRata.isNegative()}
        />
      </section>

      {belumDihitung > 0 ? (
        <p className="mb-4 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
          {belumDihitung} tagihan belum punya catatan biaya sama sekali, jadi seluruh nilainya
          terhitung sebagai untung. Angka di atas baru bisa dipercaya setelah biayanya dicatat.
        </p>
      ) : null}

      <div className="pb-4">
        <Pencarian placeholder="Cari nomor tagihan atau pelanggan…" />
      </div>

      <h2 className="pb-2.5 text-sm font-semibold tracking-[-0.01em]">
        Nyata · dari tagihan
      </h2>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Belum ada tagihan"}
            keterangan="Margin dihitung per tagihan, jadi buat tagihan lebih dulu."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-36">Tagihan</Th>
                <Th>Pelanggan</Th>
                <Th className="hidden w-36 text-right lg:table-cell">Penjualan</Th>
                <Th className="w-36 text-right">Biaya</Th>
                <Th className="w-36 text-right">Untung / rugi</Th>
                <Th className="w-24 text-right">Margin</Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((t) => {
                const m = t.invoice_margins;
                const rugi = m?.profit_status === "rugi";
                const belumAda = t._count.invoice_costs === 0;

                return (
                  <tr key={t.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                    <Td>
                      <Link
                        href={`/tagihan/${t.id}/margin`}
                        className="nomor-dokumen underline-offset-4 hover:underline"
                      >
                        {t.invoice_number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {format(t.invoice_date, "d MMM yy", { locale: localeId })}
                        {m?.status === "final" ? " · final" : ""}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-medium">{t.customers.name}</span>
                      {t.event_type ? (
                        <span className="block text-xs text-muted-foreground">
                          {t.event_type}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="angka hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                      {rupiah(m?.net_sales ?? t.subtotal)}
                    </Td>
                    <Td className="angka text-right tabular-nums text-muted-foreground">
                      {belumAda ? (
                        <span className="text-xs">belum dicatat</span>
                      ) : (
                        rupiah(m?.total_cost ?? 0)
                      )}
                    </Td>
                    <Td
                      className={`angka text-right font-medium tabular-nums ${rugi ? "text-tempo" : ""}`}
                    >
                      {rupiah(m?.profit ?? t.subtotal)}
                    </Td>
                    <Td className={`angka text-right tabular-nums ${rugi ? "text-tempo" : ""}`}>
                      <span className="inline-flex items-center gap-1">
                        {m?.status === "final" ? (
                          <Lock className="size-3 text-muted-foreground" aria-label="final" />
                        ) : null}
                        {Number(m?.margin_percent ?? 100)
                          .toString()
                          .replace(".", ",")}
                        %
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} tagihan · tagihan yang dibatalkan tidak dihitung
        </RingkasanTabel>
      ) : null}

      {perkiraan.length > 0 ? (
        <section className="pt-8">
          <h2 className="pb-1 text-sm font-semibold tracking-[-0.01em]">
            Perkiraan · dari penawaran
          </h2>
          <p className="pb-2.5 text-xs text-muted-foreground">
            Penawaran yang belum jadi tagihan, memakai perkiraan biaya yang dicatat di
            penawarannya. Dipakai menimbang harga sebelum dikirim ke klien.
          </p>

          <BingkaiTabel>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th className="w-36">Penawaran</Th>
                  <Th>Pelanggan</Th>
                  <Th className="hidden w-36 text-right lg:table-cell">Penjualan</Th>
                  <Th className="w-36 text-right">Perkiraan biaya</Th>
                  <Th className="w-36 text-right">Perkiraan untung</Th>
                  <Th className="w-24 text-right">Margin</Th>
                </tr>
              </thead>
              <tbody>
                {perkiraan.map(({ p, hasil, adaBiaya }) => {
                  const rugi = hasil.profit_status === "rugi";

                  return (
                    <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                      <Td>
                        <Link
                          href={`/penawaran/${p.id}/margin`}
                          className="nomor-dokumen underline-offset-4 hover:underline"
                        >
                          {p.quotation_number}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {format(p.quotation_date, "d MMM yy", { locale: localeId })}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-medium">{p.customers.name}</span>
                        {p.event_type ? (
                          <span className="block text-xs text-muted-foreground">
                            {p.event_type}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="angka hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                        {rupiah(hasil.net_sales)}
                      </Td>
                      <Td className="angka text-right tabular-nums text-muted-foreground">
                        {adaBiaya ? (
                          rupiah(hasil.total_cost)
                        ) : (
                          <span className="text-xs">belum dicatat</span>
                        )}
                      </Td>
                      <Td
                        className={`angka text-right font-medium tabular-nums ${rugi ? "text-tempo" : ""}`}
                      >
                        {rupiah(hasil.profit.abs())}
                      </Td>
                      <Td className={`angka text-right tabular-nums ${rugi ? "text-tempo" : ""}`}>
                        {hasil.margin_percent.toString().replace(".", ",")}%
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </BingkaiTabel>

          <RingkasanTabel>
            {perkiraan.length} penawaran · yang sudah jadi tagihan tidak dihitung dua kali
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
