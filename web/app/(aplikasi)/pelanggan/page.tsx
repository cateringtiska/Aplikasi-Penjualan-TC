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
import { wajibPeran } from "@/lib/rbac";

import { AksiBaris } from "./aksi-baris";
import { DialogPelanggan } from "./dialog-pelanggan";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function HalamanPelanggan({
  searchParams,
}: PageProps<"/pelanggan">) {
  await wajibPeran("sales", "finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  // Penyaringan dikerjakan database, bukan di browser. Aplikasi Laravel-nya
  // menarik seluruh tabel lalu menyaring di PHP — itu yang membuatnya berat
  // begitu datanya bertambah.
  const daftar = await prisma.customers.findMany({
    where: kunci
      ? {
          OR: [
            { name: { contains: kunci, mode: "insensitive" } },
            { customer_code: { contains: kunci, mode: "insensitive" } },
            { phone: { contains: kunci, mode: "insensitive" } },
            { pic_name: { contains: kunci, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      customer_code: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      npwp: true,
      pic_name: true,
      status: true,
    },
  });

  const jumlahAktif = daftar.filter((p) => p.status === "active").length;

  return (
    <Halaman>
      <KepalaHalaman
        judul="Customer"
        keterangan="Data customer yang dipakai di quotation dan invoice."
        aksi={<DialogPelanggan />}
      />

      <div className="pb-4">
        <Pencarian placeholder="Cari nama, kode, PIC, atau telepon…" />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Belum ada customer"}
            keterangan={
              kunci
                ? `Tidak ditemukan pelanggan untuk "${kunci}".`
                : "Tambahkan customer pertama supaya bisa dipilih saat membuat quotation."
            }
            aksi={kunci ? undefined : <DialogPelanggan />}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-28">Kode</Th>
                <Th>Nama</Th>
                <Th className="hidden md:table-cell">PIC</Th>
                <Th className="hidden sm:table-cell">Telepon</Th>
                <Th className="w-24">Status</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => {
                const aktif = p.status === "active";
                return (
                  <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                    <Td className="nomor-dokumen text-muted-foreground">{p.customer_code}</Td>
                    <Td>
                      <span className="font-medium">{p.name}</span>
                      {p.email ? (
                        <span className="block text-xs text-muted-foreground">{p.email}</span>
                      ) : null}
                    </Td>
                    <Td className="hidden text-muted-foreground md:table-cell">
                      {p.pic_name || "—"}
                    </Td>
                    <Td className="hidden text-muted-foreground sm:table-cell">
                      {p.phone || "—"}
                    </Td>
                    <Td>
                      <LencanaAktif aktif={aktif} />
                    </Td>
                    <Td className="text-right">
                      <AksiBaris
                        aktif={aktif}
                        pelanggan={{
                          id: p.id.toString(),
                          customer_code: p.customer_code,
                          name: p.name,
                          address: p.address,
                          phone: p.phone,
                          email: p.email,
                          npwp: p.npwp,
                          pic_name: p.pic_name,
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
          {daftar.length} pelanggan{kunci ? " cocok" : ""} · {jumlahAktif} aktif
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

/**
 * Aktif dibiarkan tanpa warna — itu keadaan normal dan tidak perlu menarik
 * perhatian. Yang diberi tanda justru yang nonaktif, karena itu yang
 * menjelaskan kenapa sebuah nama tidak muncul di daftar pilihan penawaran.
 */
function LencanaAktif({ aktif }: { aktif: boolean }) {
  if (aktif) return <span className="text-xs text-muted-foreground">Aktif</span>;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong/60 bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full ring-1 ring-current" aria-hidden="true" />
      Nonaktif
    </span>
  );
}
