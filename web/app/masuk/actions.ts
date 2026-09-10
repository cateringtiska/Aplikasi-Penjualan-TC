"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { masuk } from "@/lib/auth";

const skema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email belum diisi.")
    .email("Format email belum benar."),
  sandi: z.string().min(1, "Kata sandi belum diisi."),
});

export type KeadaanForm = {
  pesan?: string;
  galat?: { email?: string; sandi?: string };
};

export async function aksiMasuk(
  _sebelumnya: KeadaanForm,
  data: FormData,
): Promise<KeadaanForm> {
  const hasil = skema.safeParse({
    email: data.get("email"),
    sandi: data.get("sandi"),
  });

  if (!hasil.success) {
    const bidang = z.flattenError(hasil.error).fieldErrors;
    return {
      galat: {
        email: bidang.email?.[0],
        sandi: bidang.sandi?.[0],
      },
    };
  }

  const percobaan = await masuk(hasil.data.email, hasil.data.sandi);

  if (!percobaan.berhasil) {
    return { pesan: percobaan.pesan };
  }

  // redirect() bekerja dengan melempar sinyal khusus Next.js, jadi harus
  // dipanggil di luar blok try/catch mana pun.
  redirect("/dasbor");
}
