import type { Metadata } from "next";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import type { Peran } from "@/lib/auth";
import { LABEL_PERAN, MENU } from "@/lib/navigasi";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";

import { AksiBaris } from "./aksi-baris";
import { DialogPengguna } from "./dialog-pengguna";

export const metadata: Metadata = { title: "Pengguna" };
export const dynamic = "force-dynamic";

const URUTAN_PERAN: Peran[] = ["admin", "sales", "finance"];

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
  const halaman = MENU.flatMap((k) =>
    k.butir.map((b) => ({ kelompok: k.judul, label: b.label, peran: b.peran })),
  );

  return (
    <Halaman>
      <KepalaHalaman
        judul="Pengguna"
        keterangan="Akun yang boleh masuk ke aplikasi ini, beserta peran masing-masing."
        aksi={<DialogPengguna />}
      />

      <p className="mb-4 rounded-md border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
        Masuk memakai <strong className="text-foreground">nama pengguna</strong>, bukan email.
        Tidak ada pendaftaran mandiri — akun hanya dibuat dari halaman ini, dan hanya oleh admin.
      </p>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada pengguna" aksi={<DialogPengguna />} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Nama</Th>
                <Th className="w-40">Nama pengguna</Th>
                <Th className="hidden lg:table-cell">Email</Th>
                <Th className="w-28">Peran</Th>
                <Th className="w-32">Status</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
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
          {daftar.length} pengguna · {jumlahAktif} aktif
        </RingkasanTabel>
      ) : null}

      {/* Matriks hak akses */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Hak akses tiap peran</h2>
        <p className="mt-0.5 pb-3 text-xs text-muted-foreground">
          Dibaca dari pengaturan menu yang sama yang dipakai penjaga akses di server, jadi tabel
          ini selalu mencerminkan keadaan sebenarnya.
        </p>

        <BingkaiTabel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Halaman</Th>
                {URUTAN_PERAN.map((p) => (
                  <Th key={p} className="w-24 text-center">
                    {LABEL_PERAN[p]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {halaman.map((h) => (
                <tr key={h.label} className="border-b last:border-0">
                  <Td>
                    <span>{h.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{h.kelompok}</span>
                  </Td>
                  {URUTAN_PERAN.map((peran) => {
                    // Admin selalu lolos, apa pun yang tertulis di peta menu.
                    const boleh =
                      peran === "admin" ||
                      h.peran.includes(peran as Exclude<Peran, "admin">);
                    return (
                      <Td key={peran} className="text-center">
                        {boleh ? (
                          <span className="text-lunas" aria-label="boleh">
                            ✓
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40" aria-label="tidak boleh">
                            —
                          </span>
                        )}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
