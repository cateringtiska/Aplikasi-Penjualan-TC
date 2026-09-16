import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus } from "lucide-react";
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
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { d, rupiah } from "@/lib/uang";

import { AksiBaris } from "./aksi-baris";

export const metadata: Metadata = { title: "Pembayaran" };
export const dynamic = "force-dynamic";

const LABEL_METODE: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer bank",
  giro: "Giro",
  lainnya: "Lainnya",
};

export default async function HalamanPembayaran({ searchParams }: PageProps<"/pembayaran">) {
  await wajibPeran("finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const daftar = await prisma.payments.findMany({
    where: kunci
      ? {
          OR: [
            { payment_number: { contains: kunci, mode: "insensitive" } },
            { customers: { name: { contains: kunci, mode: "insensitive" } } },
            { bank_cash: { contains: kunci, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { id: "desc" },
    select: {
      id: true,
      payment_number: true,
      payment_date: true,
      payment_method: true,
      bank_cash: true,
      total_amount: true,
      customers: { select: { name: true } },
      _count: { select: { payment_details: true } },
    },
  });

  const total = daftar.reduce((jumlah, p) => jumlah.plus(d(p.total_amount)), d(0));

  return (
    <Halaman>
      <KepalaHalaman
        judul="Pembayaran"
        keterangan="Setoran yang masuk dari customer beserta alokasinya ke invoice."
        aksi={
          <Button size="sm" render={<Link href="/pembayaran/baru" />}>
            <Plus className="size-4" />
            Catat pembayaran
          </Button>
        }
      />

      <div className="pb-4">
        <Pencarian placeholder="Cari nomor, customer, atau bank…" />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Belum ada pembayaran"}
            keterangan={
              kunci
                ? `Tidak ditemukan pembayaran untuk "${kunci}".`
                : "Pembayaran dicatat dari halaman invoice atau lewat tombol di atas."
            }
            aksi={
              kunci ? undefined : (
                <Button size="sm" render={<Link href="/pembayaran/baru" />}>
                  <Plus className="size-4" />
                  Catat pembayaran
                </Button>
              )
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-36">Nomor</Th>
                <Th>Customer</Th>
                <Th className="hidden w-32 md:table-cell">Tanggal</Th>
                <Th className="hidden w-40 lg:table-cell">Cara bayar</Th>
                <Th className="w-36 text-right">Jumlah</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/pembayaran/${p.id}`}
                      className="nomor-dokumen underline-offset-4 hover:underline"
                    >
                      {p.payment_number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {p._count.payment_details} invoice
                    </span>
                  </Td>
                  <Td className="font-medium">{p.customers.name}</Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {format(p.payment_date, "d MMM yyyy", { locale: localeId })}
                  </Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">
                    {LABEL_METODE[p.payment_method] ?? p.payment_method}
                    {p.bank_cash ? (
                      <span className="block text-xs">{p.bank_cash}</span>
                    ) : null}
                  </Td>
                  <Td className="angka text-right font-medium tabular-nums">
                    {rupiah(p.total_amount)}
                  </Td>
                  <Td className="text-right">
                    <AksiBaris id={p.id.toString()} nomor={p.payment_number} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} pembayaran · total {rupiah(total)}
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
