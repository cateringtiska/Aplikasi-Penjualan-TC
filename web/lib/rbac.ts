import "server-only";

import { redirect } from "next/navigation";

import { penggunaAktif, type Peran, type Sesi } from "./auth";
import { bacaIzin } from "./izin";
import { bolehBuka, type KunciMenu } from "./navigasi";

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

/* -------------------------------------------------------------------------
   SALES HANYA MELIHAT YANG IA KERJAKAN SENDIRI
   ------------------------------------------------------------------------- */

/**
 * Penyaring dokumen untuk peran Sales.
 *
 * Peran Sales dulu melihat ANGKA SELURUH PERUSAHAAN: total piutang, total
 * penjualan bulan ini, seluruh daftar quotation dan invoice, laporan
 * penjualan, kartu piutang. Bukan hanya yang ia kerjakan sendiri. Seorang
 * sales baru masuk kerja langsung mengetahui omzet dan piutang perusahaan.
 *
 * Dikembalikan sebagai POTONGAN `where`, bukan sebagai pemeriksaan setelah
 * data terambil. Penyaring yang dipasang di kueri tidak bisa lupa dipakai
 * oleh penjumlahan di bawahnya — sedangkan pemeriksaan setelahnya hanya
 * menyembunyikan baris, dan totalnya terlanjur dihitung dari semuanya.
 *
 * Finance, cost, dan admin tidak disaring: mengurus uang dan biaya
 * perusahaan memang pekerjaan mereka.
 */
export type SaringMilik = { created_by?: bigint };

export function hanyaMiliknya(sesi: Sesi): SaringMilik {
  if (sesi.peran === "sales") return { created_by: BigInt(sesi.id) };
  return {};
}

/** Versi untuk server action: melempar, bukan mengalihkan halaman. */
export async function pastikanPeran(...diizinkan: Peran[]): Promise<Sesi> {
  const sesi = await penggunaAktif();

  if (!sesi) throw new Error("Sesi berakhir atau akun dinonaktifkan. Silakan masuk kembali.");
  if (sesi.peran === "admin") return sesi;
  if (diizinkan.includes(sesi.peran)) return sesi;

  throw new Error("Anda tidak punya akses untuk tindakan ini.");
}

/* -------------------------------------------------------------------------
   PENJAGA BERDASARKAN IZIN YANG DIATUR ADMIN
   ------------------------------------------------------------------------- */

/**
 * Memastikan pengguna boleh membuka halaman ini menurut tabel izin.
 *
 * Menggantikan wajibPeran() yang daftar perannya tertulis di dalam kode.
 * Keduanya tetap ada: wajibPeran untuk yang memang tidak pernah berubah,
 * wajibIzin untuk yang boleh diatur pemiliknya.
 *
 * Penjaga INILAH yang berlaku, bukan menu yang disembunyikan. Menyembunyikan
 * menu tidak pernah cukup — siapa pun bisa mengetik alamatnya langsung.
 */
export async function wajibIzin(kunci: KunciMenu): Promise<Sesi> {
  const sesi = await wajibSesi();
  const izin = await bacaIzin();

  if (bolehBuka(sesi.peran, kunci, izin)) return sesi;

  redirect("/dasbor?akses=ditolak");
}

/** Versi untuk server action: melempar, bukan mengalihkan halaman. */
export async function pastikanIzin(kunci: KunciMenu): Promise<Sesi> {
  const sesi = await penggunaAktif();
  if (!sesi) throw new Error("Sesi berakhir atau akun dinonaktifkan. Silakan masuk kembali.");

  const izin = await bacaIzin();
  if (bolehBuka(sesi.peran, kunci, izin)) return sesi;

  throw new Error("Anda tidak punya akses untuk tindakan ini.");
}
