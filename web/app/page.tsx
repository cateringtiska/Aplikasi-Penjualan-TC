import { redirect } from "next/navigation";

import { sesiSekarang } from "@/lib/auth";

export default async function Beranda() {
  redirect((await sesiSekarang()) ? "/dasbor" : "/masuk");
}
