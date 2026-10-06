import "server-only";

import { cache } from "react";

import { kunciIzin, type PetaIzin } from "./navigasi";
import { prisma } from "./prisma";

/* ==========================================================================
   MEMBACA IZIN YANG TERSIMPAN

   Aturan siapa-boleh-apa ada di lib/navigasi.ts, murni dan teruji. Di sini
   hanya pembacaan tabelnya.
   ========================================================================== */

/**
 * Seluruh izin, dibaca SEKALI per permintaan.
 *
 * `cache` dari React menahan hasilnya selama satu permintaan berlangsung.
 * Satu halaman memanggil penjaganya sekali dan menggambar menunya sekali,
 * dan keduanya harus melihat keadaan yang sama persis — menu yang
 * menampilkan halaman yang ternyata ditolak adalah cara paling
 * membingungkan untuk memberitahu orang bahwa ia tidak punya akses.
 */
export const bacaIzin = cache(async (): Promise<PetaIzin> => {
  const baris = await prisma.role_permissions.findMany({
    select: { role: true, menu_key: true, allowed: true },
  });

  return new Map(baris.map((b) => [kunciIzin(b.role, b.menu_key), b.allowed]));
});
