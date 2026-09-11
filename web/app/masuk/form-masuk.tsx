"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { aksiMasuk, type KeadaanForm } from "./actions";

const keadaanAwal: KeadaanForm = {};

export function FormMasuk() {
  const [keadaan, kirim, sedangKirim] = useActionState(aksiMasuk, keadaanAwal);

  return (
    <form action={kirim} className="flex flex-col gap-5" noValidate>
      {keadaan.pesan ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{keadaan.pesan}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Nama pengguna</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="mis. budi"
          aria-invalid={Boolean(keadaan.galat?.username)}
          aria-describedby={keadaan.galat?.username ? "galat-username" : undefined}
        />
        {keadaan.galat?.username ? (
          <p id="galat-username" className="text-xs text-destructive">
            {keadaan.galat.username}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sandi">Kata sandi atau PIN</Label>
        <Input
          id="sandi"
          name="sandi"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(keadaan.galat?.sandi)}
          aria-describedby={keadaan.galat?.sandi ? "galat-sandi" : undefined}
        />
        {keadaan.galat?.sandi ? (
          <p id="galat-sandi" className="text-xs text-destructive">
            {keadaan.galat.sandi}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="mt-1 w-full" disabled={sedangKirim}>
        {sedangKirim ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Memeriksa…
          </>
        ) : (
          "Masuk"
        )}
      </Button>
    </form>
  );
}
