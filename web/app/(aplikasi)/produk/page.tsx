import type { Metadata } from "next";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { Pencarian } from "@/components/pencarian";
import { prisma } from "@/lib/prisma";
import { wajibIzin } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

import { AksiBaris } from "./aksi-baris";
import { DialogProduk } from "./dialog-produk";

export const metadata: Metadata = { title: "Product" };
export const dynamic = "force-dynamic";

export default async function HalamanProduk({ searchParams }: PageProps<"/produk">) {
  await wajibIzin("produk");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const daftar = await prisma.products.findMany({
    where: kunci
      ? {
          OR: [
            { name: { contains: kunci, mode: "insensitive" } },
            { product_code: { contains: kunci, mode: "insensitive" } },
            { description: { contains: kunci, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      product_code: true,
      name: true,
      type: true,
      unit: true,
      default_price: true,
      description: true,
      status: true,
    },
  });

  const jumlahAktif = daftar.filter((p) => p.status === "active").length;

  return (
    <Halaman>
      <KepalaHalaman
        judul="Product"
        keterangan="Katalog barang dan jasa beserta harga standarnya."
        aksi={<DialogProduk />}
      />

      <div className="pb-4">
        <Pencarian placeholder="Cari nama, kode, atau keterangan…" />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Belum ada product"}
            keterangan={
              kunci
                ? `Tidak ditemukan product untuk "${kunci}".`
                : "Tambahkan product supaya harganya terisi otomatis saat membuat quotation."
            }
            aksi={kunci ? undefined : <DialogProduk />}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-24">Kode</Th>
                <Th>Nama</Th>
                <Th className="hidden w-24 sm:table-cell">Jenis</Th>
                <Th className="hidden w-24 md:table-cell">Satuan</Th>
                <Th className="w-36 text-right">Harga standar</Th>
                <Th className="w-24">Status</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => {
                const aktif = p.status === "active";
                return (
                  <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                    <Td className="nomor-dokumen text-muted-foreground">{p.product_code}</Td>
                    <Td>
                      <span className="font-medium">{p.name}</span>
                      {p.description ? (
                        <span className="block max-w-md truncate text-xs text-muted-foreground">
                          {p.description}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="hidden capitalize text-muted-foreground sm:table-cell">
                      {p.type}
                    </Td>
                    <Td className="hidden text-muted-foreground md:table-cell">{p.unit}</Td>
                    <Td className="angka text-right font-medium tabular-nums">
                      {rupiah(p.default_price)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        per {p.unit}
                      </span>
                    </Td>
                    <Td>
                      <LencanaAktif aktif={aktif} />
                    </Td>
                    <Td className="text-right">
                      <AksiBaris
                        aktif={aktif}
                        produk={{
                          id: p.id.toString(),
                          product_code: p.product_code,
                          name: p.name,
                          type: p.type,
                          unit: p.unit,
                          default_price: p.default_price.toString(),
                          description: p.description,
                        }}
                      />
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
          {daftar.length} product{kunci ? " cocok" : ""} · {jumlahAktif} aktif
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

function LencanaAktif({ aktif }: { aktif: boolean }) {
  if (aktif) return <span className="text-xs text-muted-foreground">Aktif</span>;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong/60 bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full ring-1 ring-current" aria-hidden="true" />
      Nonaktif
    </span>
  );
}
