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
import { StatusPenawaran } from "@/components/lencana-status";
import { Pencarian } from "@/components/pencarian";
import { SaringStatus } from "@/components/saring-status";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { namaPic } from "@/lib/kontak";
import { hanyaMiliknya, wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

import { tandaiKadaluarsa } from "./actions";
import { AksiBaris } from "./aksi-baris";

export const metadata: Metadata = { title: "Quotation" };
export const dynamic = "force-dynamic";

const STATUS = [
  { nilai: "", label: "Semua" },
  { nilai: "draft", label: "Draft" },
  { nilai: "sent", label: "Terkirim" },
  { nilai: "approved", label: "Disetujui" },
  { nilai: "rejected", label: "Ditolak" },
  { nilai: "expired", label: "Kadaluarsa" },
];

export default async function HalamanPenawaran({ searchParams }: PageProps<"/penawaran">) {
  const sesi = await wajibPeran("sales", "finance");

  // Menandai yang masa berlakunya lewat sebelum daftar digambar, supaya
  // status di layar tidak pernah bertentangan dengan tanggalnya.
  await tandaiKadaluarsa();

  const { cari, status } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";
  const saring = typeof status === "string" ? status : "";

  const daftar = await prisma.quotations.findMany({
    where: {
      ...hanyaMiliknya(sesi),
      ...(saring ? { status: saring } : {}),
      ...(kunci
        ? {
            OR: [
              { quotation_number: { contains: kunci, mode: "insensitive" } },
              { customers: { name: { contains: kunci, mode: "insensitive" } } },
              { event_type: { contains: kunci, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      quotation_number: true,
      quotation_date: true,
      valid_until: true,
      event_date: true,
      event_type: true,
      grand_total: true,
      status: true,
      contact_person: true,
      customers: { select: { name: true, pic_name: true } },
    },
  });

  const nilaiTotal = daftar.reduce((jumlah, p) => jumlah + Number(p.grand_total), 0);

  return (
    <Halaman>
      <KepalaHalaman
        judul="Quotation"
        keterangan="Quotation harga yang dikirim ke customer sebelum menjadi invoice."
        aksi={
          <Button size="sm" render={<Link href="/penawaran/baru" />}>
            <Plus className="size-4" />
            Buat quotation
          </Button>
        }
      />

      <div className="flex flex-col gap-3 pb-4">
        <Pencarian placeholder="Cari nomor, customer, atau jenis acara…" />
        <SaringStatus pilihan={STATUS} />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci || saring ? "Tidak ada yang cocok" : "Belum ada quotation"}
            keterangan={
              kunci || saring
                ? "Coba ubah kata kunci atau penyaring statusnya."
                : "Buat quotation pertama untuk mulai mencatat penjualan."
            }
            aksi={
              kunci || saring ? undefined : (
                <Button size="sm" render={<Link href="/penawaran/baru" />}>
                  <Plus className="size-4" />
                  Buat quotation
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
                <Th className="hidden w-32 lg:table-cell">Berlaku sampai</Th>
                <Th className="w-36 text-right">Nilai</Th>
                <Th className="w-32">Status</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/penawaran/${p.id}`}
                      className="nomor-dokumen underline-offset-4 hover:underline"
                    >
                      {p.quotation_number}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-medium">{p.customers.name}</span>
                    <BarisKontak
                      pic={namaPic(p.contact_person, p.customers.pic_name)}
                      acara={p.event_type}
                    />
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {format(p.quotation_date, "d MMM yyyy", { locale: localeId })}
                  </Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">
                    {format(p.valid_until, "d MMM yyyy", { locale: localeId })}
                  </Td>
                  <Td className="angka text-right font-medium tabular-nums">
                    {rupiah(p.grand_total)}
                  </Td>
                  <Td>
                    <StatusPenawaran status={p.status} />
                  </Td>
                  <Td className="text-right">
                    <AksiBaris
                      id={p.id.toString()}
                      nomor={p.quotation_number}
                      status={p.status}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} quotation · nilai {rupiah(nilaiTotal)}
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

/**
 * Baris kedua di kolom Customer: siapa yang dihubungi, dan acaranya apa.
 * Bentuknya sama persis dengan daftar invoice — kedua daftar ini dibaca
 * bergantian, dan tata letak yang berbeda membuat mata mencari dua kali.
 */
function BarisKontak({ pic, acara }: { pic: string | null; acara: string | null }) {
  const bagian = [pic, acara].filter((x) => x && x.trim() !== "");
  if (bagian.length === 0) return null;

  return (
    <span className="block truncate text-xs text-muted-foreground">
      {bagian.join(" · ")}
    </span>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
