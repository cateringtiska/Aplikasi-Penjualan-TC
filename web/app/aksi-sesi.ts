"use server";

import { redirect } from "next/navigation";

import { keluar } from "@/lib/auth";

export async function aksiKeluar(): Promise<void> {
  await keluar();
  redirect("/masuk");
}
