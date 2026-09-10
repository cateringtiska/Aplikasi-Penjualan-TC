"use client";

import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Monogram } from "@/components/monogram";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Sesi } from "@/lib/auth";
import { LABEL_PERAN, menuUntuk } from "@/lib/navigasi";
import { cn } from "@/lib/utils";

/**
 * Kerangka halaman: navigasi kiri yang tetap, isi di kanan.
 *
 * Navigasinya sengaja polos — tanpa ikon per menu. Pada alat kerja yang
 * dibuka berjam-jam, deretan ikon berwarna justru menambah beban baca,
 * sementara label teks langsung terbaca. Penanda halaman aktif cukup satu:
 * latar tipis dan teks yang menguat.
 */
export function KerangkaAplikasi({
  sesi,
  onKeluar,
  children,
}: {
  sesi: Sesi;
  onKeluar: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [bukaMenu, setBukaMenu] = useState(false);
  const kelompok = menuUntuk(sesi.peran);

  return (
    <div className="flex min-h-dvh">
      {/* Navigasi tetap — layar lebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b px-5">
          <Monogram ukuran={26} />
          <span className="text-sm font-semibold tracking-[-0.01em]">Penjualan TC</span>
        </div>
        <IsiNavigasi kelompok={kelompok} />
        <KartuPengguna sesi={sesi} onKeluar={onKeluar} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bilah atas — hanya muncul di layar sempit */}
        <header className="flex h-14 items-center gap-3 border-b px-4 lg:hidden">
          <Sheet open={bukaMenu} onOpenChange={setBukaMenu}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Buka navigasi" />}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigasi</SheetTitle>
              <div className="flex h-14 items-center gap-2.5 border-b px-5">
                <Monogram ukuran={26} />
                <span className="text-sm font-semibold">Penjualan TC</span>
              </div>
              <IsiNavigasi kelompok={kelompok} onPilih={() => setBukaMenu(false)} />
              <KartuPengguna sesi={sesi} onKeluar={onKeluar} />
            </SheetContent>
          </Sheet>

          <Monogram ukuran={24} />
          <span className="text-sm font-semibold">Penjualan TC</span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function IsiNavigasi({
  kelompok,
  onPilih,
}: {
  kelompok: ReturnType<typeof menuUntuk>;
  onPilih?: () => void;
}) {
  const jalur = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {kelompok.map((k) => (
        <div key={k.judul} className="mb-5 last:mb-0">
          <p className="eyebrow px-2.5 pb-1.5">{k.judul}</p>
          <ul className="flex flex-col gap-px">
            {k.butir.map((butir) => {
              const aktif = jalur === butir.href || jalur.startsWith(`${butir.href}/`);
              return (
                <li key={butir.href}>
                  <Link
                    href={butir.href}
                    onClick={onPilih}
                    aria-current={aktif ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-[0.8125rem] transition-colors",
                      aktif
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {butir.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function KartuPengguna({ sesi, onKeluar }: { sesi: Sesi; onKeluar: () => Promise<void> }) {
  const inisial = sesi.nama
    .split(/\s+/)
    .slice(0, 2)
    .map((bagian) => bagian[0])
    .join("")
    .toUpperCase();

  return (
    <div className="border-t p-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-medium text-muted-foreground">
            {inisial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium">{sesi.nama}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {LABEL_PERAN[sesi.peran]}
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium">{sesi.nama}</span>
            <span className="block truncate text-xs text-muted-foreground">{sesi.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void onKeluar()}>
            <LogOut className="size-4" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
