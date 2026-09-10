import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Monogram } from "@/components/monogram";
import { sesiSekarang } from "@/lib/auth";

import { FormMasuk } from "./form-masuk";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function HalamanMasuk() {
  if (await sesiSekarang()) {
    redirect("/dasbor");
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-[22rem]">
        <Monogram ukuran={40} />

        <h1 className="mt-7 text-[1.375rem] font-semibold tracking-[-0.02em] text-balance">
          Masuk ke Penjualan TC
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Penawaran, tagihan, dan piutang katering Tiska.
        </p>

        <div className="mt-8">
          <FormMasuk />
        </div>

        <p className="mt-8 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
          Akun hanya dibuat oleh admin lewat menu Pengguna. Kalau Anda lupa
          kata sandi atau belum punya akses, hubungi admin.
        </p>
      </div>
    </main>
  );
}
