import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KotakRiwayat, jamWib } from "./kotak-riwayat";

describe("Riwayat input", () => {
  it("menulis jam dalam WIB, bukan jam server (UTC)", () => {
    // 07.05 UTC = 14.05 WIB
    expect(jamWib(new Date("2026-11-03T07:05:00Z"))).toMatch(/3 Nov 2026.*14[.:]05 WIB/);
  });

  it("menyebut penginput, dan menyembunyikan 'terakhir diubah' kalau sama dengan saat dibuat", () => {
    const t = new Date("2026-11-03T07:05:00Z");
    render(<KotakRiwayat dibuatOleh="Ida Ayu" dibuatPada={t} diubahPada={t} />);
    expect(screen.getByText("Ida Ayu")).toBeTruthy();
    expect(screen.queryByText("Terakhir diubah")).toBeNull();
  });

  it("menyebut nama pengubahnya", () => {
    render(
      <KotakRiwayat
        dibuatOleh="Ariz Rakhma"
        dibuatPada={new Date("2026-11-01T09:37:00Z")}
        diubahPada={new Date("2026-11-05T02:41:00Z")}
        diubahOleh="Ida Ayu"
      />,
    );
    expect(screen.getByText("Terakhir diubah oleh")).toBeTruthy();
    expect(screen.getByText("Ida Ayu")).toBeTruthy();
    expect(screen.getByText(/5 Nov 2026.*09[.:]41 WIB/)).toBeTruthy();
  });
});
