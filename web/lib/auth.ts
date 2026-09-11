import "server-only";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import { prisma } from "./prisma";

/* ==========================================================================
   LOGIN DAN SESI

   Masuk dengan NAMA PENGGUNA, bukan email. Email jadi keterangan opsional
   saja — banyak staf katering tidak punya alamat surel kerja, dan memaksakan
   satu email per orang hanya melahirkan alamat karangan yang tak pernah
   dibuka.

   Sesi disimpan sebagai JWT bertanda tangan di dalam cookie httpOnly, jadi
   tidak bisa dibaca JavaScript di browser dan tidak butuh tabel sesi.
   ========================================================================== */

export const PERAN = ["admin", "sales", "finance"] as const;
export type Peran = (typeof PERAN)[number];

export type Sesi = {
  id: string;
  nama: string;
  username: string;
  email: string | null;
  peran: Peran;
};

const NAMA_COOKIE = "sesi_tc";
const UMUR_SESI_DETIK = 60 * 60 * 8; // 8 jam kerja

/* --------------------------------------------------------------------------
   PENGUNCIAN SETELAH SALAH BERULANG

   Sandi di sini boleh berupa PIN pendek, dan PIN enam angka hanya sejuta
   kemungkinan — bagi mesin, itu hitungan menit. Penguncian inilah yang
   membuat PIN tetap masuk akal dipakai: penebak berhenti setelah lima kali,
   dan setiap percobaan berikutnya harus menunggu.

   Penghitungnya disimpan di baris pengguna, bukan di memori, karena aplikasi
   ini berjalan di banyak salinan sekaligus — hitungan di memori akan
   terpisah-pisah per salinan dan praktis tidak menahan apa pun.
   -------------------------------------------------------------------------- */

const BATAS_GAGAL = 5;
const LAMA_KUNCI_MENIT = 15;

/** Panjang minimal sandi atau PIN. Enam angka masih wajar berkat penguncian. */
export const MIN_SANDI = 6;

// Hash bcrypt sah yang tidak akan pernah cocok dengan sandi apa pun. Dipakai
// hanya untuk menyamakan waktu respons saat nama penggunanya tidak ada.
const HASH_UMPAN = "$2b$12$pWe7cq8b6WT6u6KzoiZHOevflbDnDsloC/hYQUrG4f0OMl9aq2hPe";

function kunci(): Uint8Array {
  const rahasia = process.env.AUTH_SECRET;
  if (!rahasia) {
    throw new Error(
      "AUTH_SECRET belum diisi. Tanpa ini cookie sesi tidak bisa ditandatangani.",
    );
  }
  return new TextEncoder().encode(rahasia);
}

/** Membersihkan nama pengguna: huruf kecil, tanpa spasi. */
export function rapikanUsername(nilai: string): string {
  return nilai.trim().toLowerCase();
}

/**
 * Mencocokkan sandi dengan hash bcrypt milik Laravel.
 *
 * PENTING: PHP menghasilkan hash berawalan "$2y$", sedangkan pustaka bcrypt
 * JavaScript hanya mengenali "$2a$" dan "$2b$". Ketiganya algoritma yang
 * sama persis — hanya penanda versinya berbeda. Tanpa penyesuaian ini,
 * SEMUA sandi lama akan ditolak walau benar.
 */
export async function cocokkanSandi(sandi: string, hash: string): Promise<boolean> {
  const hashSetara = hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
  return bcrypt.compare(sandi, hashSetara);
}

/** Membuat hash sandi baru dalam bentuk yang juga bisa dibaca Laravel. */
export async function buatHashSandi(sandi: string): Promise<string> {
  const hash = await bcrypt.hash(sandi, 12);
  return `$2y$${hash.slice(4)}`;
}

export type HasilMasuk =
  | { berhasil: true; sesi: Sesi }
  | { berhasil: false; pesan: string };

export async function masuk(username: string, sandi: string): Promise<HasilMasuk> {
  const pengguna = await prisma.users.findUnique({
    where: { username: rapikanUsername(username) },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      password: true,
      role: true,
      is_active: true,
      gagal_masuk: true,
      terkunci_sampai: true,
    },
  });

  // Pesan yang sama untuk nama pengguna tidak ada maupun sandi salah, supaya
  // halaman masuk tidak bisa dipakai menebak-nebak siapa saja yang terdaftar.
  const pesanUmum = "Nama user atau kata sandi salah.";

  if (!pengguna) {
    // Tetap jalankan satu perbandingan terhadap hash yang mustahil cocok,
    // supaya nama yang ada dan tidak ada memakan waktu yang sama. Tanpa ini,
    // selisih waktu respons membocorkan nama mana yang terdaftar.
    await bcrypt.compare(sandi, HASH_UMPAN);
    return { berhasil: false, pesan: pesanUmum };
  }

  const sekarang = new Date();

  if (pengguna.terkunci_sampai && pengguna.terkunci_sampai > sekarang) {
    const menit = Math.max(
      1,
      Math.ceil((pengguna.terkunci_sampai.getTime() - sekarang.getTime()) / 60000),
    );
    return {
      berhasil: false,
      pesan: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.`,
    };
  }

  if (!(await cocokkanSandi(sandi, pengguna.password))) {
    const gagal = pengguna.gagal_masuk + 1;
    const kenaKunci = gagal >= BATAS_GAGAL;

    await prisma.users.update({
      where: { id: pengguna.id },
      data: {
        gagal_masuk: kenaKunci ? 0 : gagal,
        terkunci_sampai: kenaKunci
          ? new Date(sekarang.getTime() + LAMA_KUNCI_MENIT * 60000)
          : null,
      },
    });

    if (kenaKunci) {
      return {
        berhasil: false,
        pesan: `Terlalu banyak percobaan gagal. Akun dikunci ${LAMA_KUNCI_MENIT} menit.`,
      };
    }

    const sisa = BATAS_GAGAL - gagal;
    return {
      berhasil: false,
      pesan: `${pesanUmum} Sisa ${sisa} percobaan sebelum akun dikunci sementara.`,
    };
  }

  if (!pengguna.is_active) {
    return {
      berhasil: false,
      pesan: "Akun ini dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.",
    };
  }

  // Berhasil masuk: hitungan gagal dikosongkan supaya salah ketik kemarin
  // tidak menumpuk sampai mengunci orang yang sebenarnya tahu sandinya.
  if (pengguna.gagal_masuk > 0 || pengguna.terkunci_sampai) {
    await prisma.users.update({
      where: { id: pengguna.id },
      data: { gagal_masuk: 0, terkunci_sampai: null },
    });
  }

  const sesi: Sesi = {
    id: pengguna.id.toString(),
    nama: pengguna.name,
    username: pengguna.username,
    email: pengguna.email,
    peran: pengguna.role as Peran,
  };

  await simpanSesi(sesi);
  return { berhasil: true, sesi };
}

async function simpanSesi(sesi: Sesi): Promise<void> {
  const token = await new SignJWT({ ...sesi })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${UMUR_SESI_DETIK}s`)
    .sign(kunci());

  (await cookies()).set(NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });
}

export async function keluar(): Promise<void> {
  (await cookies()).delete(NAMA_COOKIE);
}

/**
 * Sesi yang sudah dipastikan ke database.
 *
 * Cookie sesi adalah SALINAN data pengguna pada saat login, dan salinan itu
 * tidak pernah berubah sendiri sampai kedaluwarsa. Kalau hak akses hanya
 * dibaca dari sana, tiga hal jadi salah sampai 8 jam ke depan:
 *
 *   - Pengguna yang dinonaktifkan tetap bisa membuka semua halaman.
 *   - Pengguna yang perannya diturunkan tetap memegang akses lamanya.
 *   - Nama dan identitas di sidebar tetap yang lama setelah diubah.
 *
 * Karena itu setiap halaman terlindungi membaca ulang penggunanya dari
 * database. Biayanya satu pencarian lewat kunci utama — jauh lebih murah
 * daripada membiarkan akses yang seharusnya sudah dicabut tetap hidup.
 * Aplikasi Laravel-nya juga memeriksa is_active di setiap permintaan.
 */
export async function penggunaAktif(): Promise<Sesi | null> {
  const sesi = await sesiSekarang();
  if (!sesi) return null;

  let id: bigint;
  try {
    id = BigInt(sesi.id);
  } catch {
    return null;
  }

  const pengguna = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      is_active: true,
    },
  });

  // Akun dihapus atau dinonaktifkan sejak login: perlakukan sebagai belum login.
  if (!pengguna || !pengguna.is_active) return null;

  return {
    id: pengguna.id.toString(),
    nama: pengguna.name,
    username: pengguna.username,
    email: pengguna.email,
    peran: pengguna.role as Peran,
  };
}

/**
 * Isi cookie sesi apa adanya, tanpa menyentuh database.
 *
 * Hanya untuk keperluan yang tidak menentukan hak akses. Untuk memutuskan
 * boleh-tidaknya seseorang membuka sesuatu, pakai penggunaAktif().
 */
export async function sesiSekarang(): Promise<Sesi | null> {
  const token = (await cookies()).get(NAMA_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, kunci(), { algorithms: ["HS256"] });
    return {
      id: String(payload.id),
      nama: String(payload.nama),
      username: String(payload.username ?? ""),
      email: payload.email ? String(payload.email) : null,
      peran: payload.peran as Peran,
    };
  } catch {
    // Kedaluwarsa atau tanda tangannya tidak cocok — perlakukan sebagai belum login.
    return null;
  }
}
