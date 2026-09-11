"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buatHashSandi, MIN_SANDI, PERAN, rapikanUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   MANAJEMEN PENGGUNA — khusus admin

   Pendaftaran mandiri sengaja tidak ada. Di aplikasi Laravel, halaman
   /register terbuka untuk umum dan pemeriksaan verifikasi email tidak aktif,
   sehingga siapa pun yang menemukan alamatnya bisa membuat akun lalu melihat
   seluruh data pelanggan dan tagihan. Akun hanya dibuat di sini.

   Identitas masuk adalah NAMA PENGGUNA. Email hanya keterangan tambahan dan
   boleh dikosongkan — banyak staf katering tidak punya alamat surel kerja.
   ========================================================================== */

const kosongJadiNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const dasar = {
  name: z.string().trim().min(3, "Nama minimal 3 huruf.").max(255),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Nama user minimal 3 karakter.")
    .max(50, "Nama user maksimal 50 karakter.")
    .regex(
      /^[a-z0-9][a-z0-9._-]*$/,
      "Hanya huruf kecil, angka, titik, garis bawah, dan strip. Diawali huruf atau angka.",
    ),
  email: z.preprocess(kosongJadiNull, z.email("Format email belum benar.").nullable()),
  role: z.enum(PERAN, { message: "Pilih peran." }),
};

const skemaBaru = z.object({
  ...dasar,
  password: z.string().min(MIN_SANDI, `Kata sandi atau PIN minimal ${MIN_SANDI} karakter.`),
});

const skemaUbah = z.object({
  id: z.string().trim().min(1),
  ...dasar,
  // Kosong berarti sandinya tidak diubah.
  password: z.string().max(200).optional(),
});

export type KeadaanPengguna = {
  sukses?: boolean;
  pesan?: string;
  galat?: Record<string, string>;
};

/**
 * Mengubah daftar masalah zod menjadi peta "nama medan -> pesan pertama".
 *
 * Dibaca langsung dari issues, bukan lewat flattenError, supaya tidak
 * terikat pada bentuk generik skemanya — di sini ada dua skema berbeda
 * untuk tambah dan ubah.
 */
function ratakanGalat(galat: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const masalah of galat.issues) {
    const kunci = String(masalah.path[0] ?? "");
    if (kunci && !(kunci in hasil)) hasil[kunci] = masalah.message;
  }
  return hasil;
}

export async function simpanPengguna(
  _sebelumnya: KeadaanPengguna,
  data: FormData,
): Promise<KeadaanPengguna> {
  await pastikanPeran();

  const mentah = Object.fromEntries(data);
  const id = String(mentah.id ?? "").trim();

  const hasil = id ? skemaUbah.safeParse(mentah) : skemaBaru.safeParse(mentah);
  if (!hasil.success) return { galat: ratakanGalat(hasil.error) };

  const f = hasil.data;
  const username = rapikanUsername(f.username);

  const bentrokNama = await prisma.users.findFirst({
    where: { username, ...(id ? { NOT: { id: BigInt(id) } } : {}) },
    select: { id: true },
  });
  if (bentrokNama) {
    return { galat: { username: "Nama user ini sudah dipakai akun lain." } };
  }

  if (f.email) {
    const bentrokEmail = await prisma.users.findFirst({
      where: { email: f.email, ...(id ? { NOT: { id: BigInt(id) } } : {}) },
      select: { id: true },
    });
    if (bentrokEmail) return { galat: { email: "Email ini sudah dipakai akun lain." } };
  }

  try {
    if (id) {
      const sandiBaru = "password" in f && f.password ? f.password.trim() : "";
      if (sandiBaru && sandiBaru.length < MIN_SANDI) {
        return { galat: { password: `Kata sandi atau PIN minimal ${MIN_SANDI} karakter.` } };
      }

      await prisma.users.update({
        where: { id: BigInt(id) },
        data: {
          name: f.name,
          username,
          email: f.email,
          role: f.role,
          ...(sandiBaru
            ? {
                password: await buatHashSandi(sandiBaru),
                // Sandi baru membatalkan penguncian: percuma menggantinya
                // kalau pemiliknya masih harus menunggu masa kunci lewat.
                gagal_masuk: 0,
                terkunci_sampai: null,
              }
            : {}),
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.users.create({
        data: {
          name: f.name,
          username,
          email: f.email,
          role: f.role,
          password: await buatHashSandi((f as { password: string }).password),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }
  } catch {
    return { pesan: "User gagal disimpan." };
  }

  revalidatePath("/pengguna");
  return { sukses: true, pesan: id ? "Data user diperbarui." : "User baru ditambahkan." };
}

export async function ubahStatusPengguna(id: string): Promise<void> {
  const sesi = await pastikanPeran();

  if (sesi.id === id) {
    throw new Error("Anda tidak bisa menonaktifkan akun Anda sendiri.");
  }

  const pengguna = await prisma.users.findUnique({
    where: { id: BigInt(id) },
    select: { is_active: true, role: true },
  });
  if (!pengguna) return;

  if (pengguna.is_active && pengguna.role === "admin") {
    await pastikanBukanAdminTerakhir(id);
  }

  await prisma.users.update({
    where: { id: BigInt(id) },
    data: {
      is_active: !pengguna.is_active,
      // Mengaktifkan kembali sekalian membuka kunci, kalau akunnya sempat
      // terkunci karena salah sandi berulang.
      ...(pengguna.is_active ? {} : { gagal_masuk: 0, terkunci_sampai: null }),
      updated_at: new Date(),
    },
  });

  revalidatePath("/pengguna");
}

/**
 * Menghapus pengguna secara permanen.
 *
 * Dokumen yang pernah dibuatnya TIDAK ikut terhapus. Seluruh rujukan ke
 * tabel users memakai aturan ON DELETE SET NULL, jadi penawaran, tagihan,
 * dan pembayarannya tetap utuh — hanya keterangan pembuatnya yang hilang.
 *
 * Untuk staf yang sekadar berhenti bekerja, menonaktifkan lebih baik:
 * keterangan pembuat dokumennya tetap terbaca.
 */
export async function hapusPengguna(id: string): Promise<void> {
  const sesi = await pastikanPeran();

  if (sesi.id === id) {
    throw new Error("Anda tidak bisa menghapus akun Anda sendiri.");
  }

  const pengguna = await prisma.users.findUnique({
    where: { id: BigInt(id) },
    select: { role: true, is_active: true },
  });
  if (!pengguna) return;

  if (pengguna.role === "admin" && pengguna.is_active) {
    await pastikanBukanAdminTerakhir(id);
  }

  await prisma.users.delete({ where: { id: BigInt(id) } });

  revalidatePath("/pengguna");
}

/** Berapa banyak dokumen yang mencantumkan pengguna ini sebagai pembuatnya. */
export async function jejakPengguna(id: string): Promise<number> {
  await pastikanPeran();
  const pengguna = BigInt(id);

  const [penawaran, tagihan, pembayaran, pelanggan, produk] = await Promise.all([
    prisma.quotations.count({ where: { created_by: pengguna } }),
    prisma.invoices.count({ where: { created_by: pengguna } }),
    prisma.payments.count({ where: { created_by: pengguna } }),
    prisma.customers.count({ where: { created_by: pengguna } }),
    prisma.products.count({ where: { created_by: pengguna } }),
  ]);

  return penawaran + tagihan + pembayaran + pelanggan + produk;
}

/**
 * Selalu sisakan minimal satu admin aktif.
 *
 * Tanpa penjagaan ini, admin terakhir bisa menghapus atau menonaktifkan
 * dirinya lewat akun lain dan tidak ada lagi yang bisa membuat pengguna —
 * aplikasi terkunci dari dalam, karena tidak ada pendaftaran mandiri.
 */
async function pastikanBukanAdminTerakhir(id: string): Promise<void> {
  const adminAktifLain = await prisma.users.count({
    where: { role: "admin", is_active: true, NOT: { id: BigInt(id) } },
  });

  if (adminAktifLain === 0) {
    throw new Error("Ini satu-satunya admin yang aktif. Angkat admin lain lebih dulu.");
  }
}
