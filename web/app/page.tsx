import { redirect } from "next/navigation";

import { penggunaAktif } from "@/lib/auth";

export default async function Beranda() {
  redirect((await penggunaAktif()) ? "/dasbor" : "/masuk");
}
