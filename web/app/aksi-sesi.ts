"use server";

import { keluar } from "@/lib/auth";

/**
 * Menghapus cookie sesi.
 *
 * Sengaja TIDAK memanggil redirect() di sini. Perpindahan halaman diserahkan
 * ke sisi browser lewat router, supaya alurnya lurus dan mudah ditelusuri:
 * satu permintaan menghapus cookie, satu perpindahan halaman. Redirect dari
 * dalam server action bekerja dengan cara melempar sinyal khusus, dan sinyal
 * itu hanya tertangani kalau pemanggilannya dibungkus transition — hal yang
 * gampang terlupa dan gagalnya tidak menyisakan jejak apa pun di log server.
 */
export async function aksiKeluar(): Promise<void> {
  await keluar();
}
