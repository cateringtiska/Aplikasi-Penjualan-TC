"use server";

import { revalidatePath } from "next/cache";

import { butirMenu, type KunciMenu, MENU, PERAN_DIATUR } from "@/lib/navigasi";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   MENYIMPAN HAK AKSES

   HANYA ADMIN. Dan bukan sekadar karena halamannya milik admin: yang bisa
   mengubah hak akses bisa memberikan dirinya sendiri hak akses apa pun,
   jadi penjaganya harus di sini, bukan hanya di halaman yang memanggilnya.

   DUA HAL YANG DITOLAK APA PUN YANG DIKIRIM BROWSER:

   1. Kunci yang bukan menu yang dikenal. Tanpa ini, tabel izin bisa diisi
      baris yang tidak berarti apa-apa — dan baris sampah di tabel hak akses
      adalah tempat terakhir yang akan dicurigai orang.

   2. Halaman yang hanya milik admin. Halaman User bisa membuat admin baru,
      dan admin baru bisa membuka seluruh halaman lain; memberikannya ke
      peran lain diam-diam membatalkan setiap pembatasan yang lain.

   Keduanya diperiksa ULANG di server. Kotak centangnya memang dimatikan di
   layar, tetapi yang dimatikan di layar bukan penjagaan.
   ========================================================================== */

export async function simpanIzin(izin: Record<string, boolean>): Promise<void> {
  await pastikanPeran(); // Tanpa peran lain: admin saja.

  const kunciSah = new Set<string>(MENU.flatMap((k) => k.butir.map((b) => b.kunci)));
  const peranSah = new Set<string>(PERAN_DIATUR);

  const baris: { role: string; menu_key: KunciMenu; allowed: boolean }[] = [];

  for (const [gabungan, boleh] of Object.entries(izin)) {
    const pisah = gabungan.indexOf(":");
    if (pisah === -1) continue;

    const peran = gabungan.slice(0, pisah);
    const kunci = gabungan.slice(pisah + 1) as KunciMenu;

    if (!peranSah.has(peran)) continue;
    if (!kunciSah.has(kunci)) continue;
    if (butirMenu(kunci)?.hanyaAdmin) continue;

    baris.push({ role: peran, menu_key: kunci, allowed: boleh === true });
  }

  if (baris.length === 0) throw new Error("Tidak ada hak akses yang bisa disimpan.");

  // Satu transaksi: hak akses yang tersimpan setengah akan membuka sebagian
  // halaman dan menutup sebagian lainnya, tanpa ada yang tahu mana yang
  // sengaja.
  await prisma.$transaction(async (tx) => {
    for (const b of baris) {
      await tx.role_permissions.upsert({
        where: { role_menu_key: { role: b.role, menu_key: b.menu_key } },
        create: {
          role: b.role,
          menu_key: b.menu_key,
          allowed: b.allowed,
          created_at: new Date(),
          updated_at: new Date(),
        },
        update: { allowed: b.allowed, updated_at: new Date() },
      });
    }
  });

  // Seluruh aplikasi: menunya sendiri ikut berubah, jadi menyegarkan satu
  // halaman saja akan menyisakan menu lama di halaman lain.
  revalidatePath("/", "layout");
}
