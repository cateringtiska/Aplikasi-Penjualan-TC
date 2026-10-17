import type { Metadata } from "next";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import type { Peran } from "@/lib/auth";
import { bolehBuka, LABEL_PERAN, MENU, PERAN_DIATUR } from "@/lib/navigasi";
import { bacaIzin } from "@/lib/izin";
import { prisma } from "@/lib/prisma";

import { type BarisIzin, TabelIzin } from "./tabel-izin";
import { wajibPeran } from "@/lib/rbac";

import { AksiBaris } from "./aksi-baris";
import { DialogPengguna } from "./dialog-pengguna";

import { KepalaTabel, Th } from "@/components/tabel";

export const metadata: Metadata = { title: "User" };
export const dynamic = "force-dynamic";

export default async function HalamanPengguna() {
  const sesi = await wajibPeran();

  const daftar = await prisma.users.findMany({
    orderBy: [{ is_active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      is_active: true,
      terkunci_sampai: true,
    },
  });

  const jumlahAktif = daftar.filter((p) => p.is_active).length;
  const sekarang = new Date();

  // Matriks hak akses dibangun dari peta menu yang sama yang dipakai penjaga
  // akses, jadi tabel ini tidak bisa berbohong: kalau menunya berubah,
  // tampilannya ikut berubah.
  // Izin dibaca dari tabelnya, bukan dari aturan bawaan di kode: yang
  // ditampilkan harus keadaan yang BENAR-BENAR berlaku.
  const izin = await bacaIzin();

  const barisIzin: BarisIzin[] = MENU.flatMap((k) =>
    k.butir.map((b) => ({
      kunci: b.kunci,
      label: b.label,
      kelompok: k.judul,
      hanyaAdmin: b.hanyaAdmin === true,
      izin: Object.fromEntries(
        PERAN_DIATUR.map((p) => [p, bolehBuka(p, b.kunci, izin)]),
      ),
    })),
  );

  return (
    <Halaman>
      <KepalaHalaman
        judul="User"
        keterangan="Akun yang boleh masuk ke aplikasi ini, beserta peran masing-masing."
        aksi={<DialogPengguna />}
      />

      <p className="mb-4 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
        Masuk memakai <strong className="text-foreground">nama user</strong>, bukan email.
        Tidak ada pendaftaran mandiri — akun hanya dibuat dari halaman ini, dan hanya oleh admin.
      </p>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada user" aksi={<DialogPengguna />} />
        ) : (
          <table className="w-full text-sm">
            <KepalaTabel>
              <Th>Nama</Th>
              <Th className="w-40">Nama user</Th>
              <Th className="hidden lg:table-cell">Email</Th>
              <Th className="w-28">Peran</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
            </KepalaTabel>
            <tbody>
              {daftar.map((p) => {
                const diriSendiri = p.id.toString() === sesi.id;
                const terkunci = Boolean(
                  p.terkunci_sampai && p.terkunci_sampai > sekarang,
                );

                return (
                  <tr key={p.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                    <Td>
                      <span className="font-medium">{p.name}</span>
                      {diriSendiri ? (
                        <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                      ) : null}
                      {p.email ? (
                        <span className="block text-xs text-muted-foreground lg:hidden">
                          {p.email}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-[0.8125rem]">{p.username}</Td>
                    <Td className="hidden text-muted-foreground lg:table-cell">
                      {p.email ?? <span className="text-xs">—</span>}
                    </Td>
                    <Td>{LABEL_PERAN[p.role as Peran] ?? p.role}</Td>
                    <Td>
                      {!p.is_active ? (
                        <Lencana>Nonaktif</Lencana>
                      ) : terkunci ? (
                        <span className="text-xs text-tempo">Terkunci sementara</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Aktif</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <AksiBaris
                        aktif={p.is_active}
                        diriSendiri={diriSendiri}
                        pengguna={{
                          id: p.id.toString(),
                          name: p.name,
                          username: p.username,
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
          {daftar.length} user · {jumlahAktif} aktif
        </RingkasanTabel>
      ) : null}

      {/* Matriks hak akses — bisa diubah langsung oleh admin. */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Hak akses tiap peran</h2>
        <p className="mt-0.5 pb-3 text-xs text-muted-foreground">
          Centang halaman yang boleh dibuka tiap peran. Tabel ini dibaca penjaga akses di
          server, jadi yang dicentang di sini benar-benar menentukan — bukan sekadar
          menyembunyikan menunya.
        </p>

        <BingkaiTabel>
          <TabelIzin baris={barisIzin} peranDiatur={PERAN_DIATUR} />
        </BingkaiTabel>
      </section>
    </Halaman>
  );
}

function Lencana({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong/60 bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full ring-1 ring-current" aria-hidden="true" />
      {children}
    </span>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
