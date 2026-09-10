import "server-only";

import { redirect } from "next/navigation";

import { penggunaAktif, type Peran, type Sesi } from "./auth";

/* ==========================================================================
   PENJAGA HAK AKSES

   Menyembunyikan menu tidak pernah cukup — siapa pun bisa mengetik alamatnya
   langsung. Setiap halaman dan setiap server action HARUS memanggil salah
   satu fungsi di bawah ini sebelum menyentuh data.

   Semuanya membaca pengguna ULANG dari database lewat penggunaAktif(), bukan
   dari cookie. Cookie hanya salinan pada saat login: tanpa pembacaan ulang,
   pengguna yang dinonaktifkan atau diturunkan perannya tetap memegang akses
   lamanya sampai sesinya kedaluwarsa.

   Sesuai perilaku Laravel: peran admin selalu lolos, apa pun yang diminta.
   ========================================================================== */

export async function wajibSesi(): Promise<Sesi> {
  const sesi = await penggunaAktif();
  if (!sesi) redirect("/masuk");
  return sesi;
}

/**
 * Memastikan pengguna punya salah satu peran yang diizinkan.
 * Admin selalu lolos tanpa perlu disebut.
 */
export async function wajibPeran(...diizinkan: Peran[]): Promise<Sesi> {
  const sesi = await wajibSesi();

  if (sesi.peran === "admin") return sesi;
  if (diizinkan.includes(sesi.peran)) return sesi;

  redirect("/dasbor?akses=ditolak");
}

/** Versi untuk server action: melempar, bukan mengalihkan halaman. */
export async function pastikanPeran(...diizinkan: Peran[]): Promise<Sesi> {
  const sesi = await penggunaAktif();

  if (!sesi) throw new Error("Sesi berakhir atau akun dinonaktifkan. Silakan masuk kembali.");
  if (sesi.peran === "admin") return sesi;
  if (diizinkan.includes(sesi.peran)) return sesi;

  throw new Error("Anda tidak punya akses untuk tindakan ini.");
}
