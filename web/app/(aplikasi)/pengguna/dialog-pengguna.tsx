"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type KeadaanPengguna, simpanPengguna } from "./actions";

export type Pengguna = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
};

/** Apa yang boleh dibuka tiap peran. Disalin dari lib/navigasi.ts. */
const PERAN = [
  {
    nilai: "admin",
    label: "Admin",
    jelas: "Semua halaman, plus User dan Pengaturan perusahaan.",
  },
  {
    nilai: "sales",
    label: "Sales",
    jelas: "Quotation, tagihan, customer, produk, laporan penjualan dan piutang.",
  },
  {
    nilai: "finance",
    label: "Finance",
    jelas: "Semua milik Sales, ditambah pembayaran dan laporan margin.",
  },
];

const keadaanAwal: KeadaanPengguna = {};

export function DialogPengguna({
  pengguna,
  terbuka: terbukaLuar,
  onTerbukaChange,
}: {
  pengguna?: Pengguna;
  terbuka?: boolean;
  onTerbukaChange?: (nilai: boolean) => void;
}) {
  const [terbukaDalam, setTerbukaDalam] = useState(false);
  const [keadaan, kirim, sedangKirim] = useActionState(simpanPengguna, keadaanAwal);
  const sedangUbah = Boolean(pengguna);

  const dikendalikan = terbukaLuar !== undefined;
  const terbuka = dikendalikan ? terbukaLuar : terbukaDalam;
  const setTerbuka = dikendalikan ? (onTerbukaChange ?? (() => {})) : setTerbukaDalam;

  useEffect(() => {
    if (keadaan.sukses) {
      toast.success(keadaan.pesan);
      setTerbuka(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keadaan]);

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      {dikendalikan ? null : (
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus className="size-4" />
              Tambah user
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sedangUbah ? "Ubah user" : "User baru"}</DialogTitle>
          <DialogDescription>
            {sedangUbah
              ? "Kosongkan kata sandi kalau tidak ingin menggantinya."
              : "Akun langsung aktif dan bisa dipakai masuk."}
          </DialogDescription>
        </DialogHeader>

        <form action={kirim} className="flex flex-col gap-4" noValidate>
          {pengguna ? <input type="hidden" name="id" value={pengguna.id} /> : null}

          {keadaan.pesan && !keadaan.sukses ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {keadaan.pesan}
            </p>
          ) : null}

          <Bidang label="Nama lengkap" nama="name" galat={keadaan.galat?.name} wajib>
            <Input
              id="name"
              name="name"
              defaultValue={pengguna?.name ?? ""}
              autoFocus
              placeholder="Budi Santoso"
            />
          </Bidang>

          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang
              label="Nama user"
              nama="username"
              galat={keadaan.galat?.username}
              keterangan="Dipakai untuk masuk."
              wajib
            >
              <Input
                id="username"
                name="username"
                defaultValue={pengguna?.username ?? ""}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="budi"
                className="font-mono"
              />
            </Bidang>

            <Bidang
              label={sedangUbah ? "Sandi baru" : "Kata sandi atau PIN"}
              nama="password"
              galat={keadaan.galat?.password}
              keterangan="Minimal 6 karakter. Boleh berupa PIN angka."
              wajib={!sedangUbah}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={sedangUbah ? "Biarkan kosong untuk tetap" : "mis. 246810"}
              />
            </Bidang>
          </div>

          <Bidang
            label="Email"
            nama="email"
            galat={keadaan.galat?.email}
            keterangan="Boleh dikosongkan — tidak dipakai untuk masuk."
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              defaultValue={pengguna?.email ?? ""}
              placeholder="opsional"
            />
          </Bidang>

          <div className="flex flex-col gap-2">
            <Label>
              Peran<span className="text-muted-foreground"> *</span>
            </Label>
            <div className="flex flex-col gap-2">
              {PERAN.map((p) => (
                <label
                  key={p.nilai}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors has-[:checked]:border-foreground/35 has-[:checked]:bg-accent"
                >
                  <input
                    type="radio"
                    name="role"
                    value={p.nilai}
                    defaultChecked={(pengguna?.role ?? "sales") === p.nilai}
                    className="mt-1 accent-foreground"
                  />
                  <span>
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.jelas}</span>
                  </span>
                </label>
              ))}
            </div>
            {keadaan.galat?.role ? (
              <p className="text-xs text-destructive">{keadaan.galat.role}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-1">
            <Button type="button" variant="ghost" onClick={() => setTerbuka(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Menyimpan…
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Bidang({
  label,
  nama,
  galat,
  wajib,
  keterangan,
  children,
}: {
  label: string;
  nama: string;
  galat?: string;
  wajib?: boolean;
  keterangan?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={nama}>
        {label}
        {wajib ? <span className="text-muted-foreground"> *</span> : null}
      </Label>
      {children}
      {galat ? (
        <p className="text-xs text-destructive">{galat}</p>
      ) : keterangan ? (
        <p className="text-xs text-muted-foreground">{keterangan}</p>
      ) : null}
    </div>
  );
}
