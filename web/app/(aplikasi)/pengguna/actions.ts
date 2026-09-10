"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buatHashSandi, PERAN } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pastikanPeran } from "@/lib/rbac";

/* ==========================================================================
   MANAJEMEN PENGGUNA — khusus admin

   Pendaftaran mandiri sengaja tidak ada. Di aplikasi Laravel, halaman
   /register terbuka untuk umum dan pemeriksaan verifikasi email tidak aktif,
   sehingga siapa pun yang menemukan alamatnya bisa membuat akun lalu melihat
   seluruh data pelanggan dan tagihan. Akun hanya dibuat di sini.
   ========================================================================== */

const dasar = {
  name: z.string().trim().min(3, "Nama minimal 3 huruf.").max(255),
  email: z.email("Format email belum benar.").max(255),
  role: z.enum(PERAN, { message: "Pilih peran." }),
};

const skemaBaru = z.object({
  ...dasar,
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
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
  const email = f.email.trim().toLowerCase();

  const bentrok = await prisma.users.findFirst({
    where: { email, ...(id ? { NOT: { id: BigInt(id) } } : {}) },
    select: { id: true },
  });
  if (bentrok) return { galat: { email: "Email ini sudah dipakai akun lain." } };

  try {
    if (id) {
      const sandiBaru = "password" in f && f.password ? f.password.trim() : "";
      if (sandiBaru && sandiBaru.length < 8) {
        return { galat: { password: "Kata sandi minimal 8 karakter." } };
      }

      await prisma.users.update({
        where: { id: BigInt(id) },
        data: {
          name: f.name,
          email,
          role: f.role,
          ...(sandiBaru ? { password: await buatHashSandi(sandiBaru) } : {}),
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.users.create({
        data: {
          name: f.name,
          email,
          role: f.role,
          password: await buatHashSandi((f as { password: string }).password),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }
  } catch {
    return { pesan: "Pengguna gagal disimpan." };
  }

  revalidatePath("/pengguna");
  return { sukses: true, pesan: id ? "Data pengguna diperbarui." : "Pengguna baru ditambahkan." };
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

  // Selalu sisakan minimal satu admin aktif, kalau tidak tidak ada lagi yang
  // bisa membuat atau mengaktifkan pengguna.
  if (pengguna.is_active && pengguna.role === "admin") {
    const adminAktif = await prisma.users.count({
      where: { role: "admin", is_active: true },
    });
    if (adminAktif <= 1) {
      throw new Error("Ini satu-satunya admin yang aktif. Angkat admin lain lebih dulu.");
    }
  }

  await prisma.users.update({
    where: { id: BigInt(id) },
    data: { is_active: !pengguna.is_active, updated_at: new Date() },
  });

  revalidatePath("/pengguna");
}
