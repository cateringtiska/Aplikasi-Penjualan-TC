import { redirect } from "next/navigation";

import { penggunaAktif } from "@/lib/auth";
import { halamanAwalSesi } from "@/lib/rbac";

export default async function Beranda() {
  const sesi = await penggunaAktif();
  redirect(sesi ? await halamanAwalSesi(sesi) : "/masuk");
}
