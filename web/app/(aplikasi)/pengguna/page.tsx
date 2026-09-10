import type { Metadata } from "next";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { LABEL_PERAN } from "@/lib/navigasi";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import type { Peran } from "@/lib/auth";

import { AksiBaris } from "./aksi-baris";
import { DialogPengguna } from "./dialog-pengguna";

export const metadata: Metadata = { title: "Pengguna" };
export const dynamic = "force-dynamic";

export default async function HalamanPengguna() {
  const sesi = await wajibPeran();

  const daftar = await prisma.users.findMany({
    orderBy: [{ is_active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, is_active: true },
  });

  const jumlahAktif = daftar.filter((p) => p.is_active).length;

  return (
    <Halaman>
      <KepalaHalaman
        judul="Pengguna"
        keterangan="Akun yang boleh masuk ke aplikasi ini."
        aksi={<DialogPengguna />}
      />

      <p className="mb-4 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
        Tidak ada pendaftaran mandiri. Akun hanya bisa dibuat dari halaman ini, dan hanya oleh
        admin.
      </p>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada pengguna" aksi={<DialogPengguna />} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Nama</Th>
                <Th className="hidden sm:table-cell">Email</Th>
                <Th className="w-28">Peran</Th>
                <Th className="w-24">Status</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => {
                const diriSendiri = p.id.toString() === sesi.id;
                return (
                  <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                    <Td>
                      <span className="font-medium">{p.name}</span>
                      {diriSendiri ? (
                        <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground sm:hidden">
                        {p.email}
                      </span>
                    </Td>
                    <Td className="hidden text-muted-foreground sm:table-cell">{p.email}</Td>
                    <Td>{LABEL_PERAN[p.role as Peran] ?? p.role}</Td>
                    <Td>
                      {p.is_active ? (
                        <span className="text-xs text-muted-foreground">Aktif</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong/60 bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                          <span
                            className="size-1.5 rounded-full ring-1 ring-current"
                            aria-hidden="true"
                          />
                          Nonaktif
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <AksiBaris
                        aktif={p.is_active}
                        diriSendiri={diriSendiri}
                        pengguna={{
                          id: p.id.toString(),
                          name: p.name,
                          email: p.email,
                          role: p.role,
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
          {daftar.length} pengguna · {jumlahAktif} aktif
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
