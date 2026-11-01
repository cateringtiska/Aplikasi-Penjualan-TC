import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PilihCari } from "./pilih-cari";

/* Kotak pilih customer yang bisa diketik: huruf yang diketik boleh ada di
   mana saja dalam nama, bukan hanya di depan — "re" harus menemukan
   "Ibu Rahmi (Tes Reza)" dan "PT Sinar Telko · Mbak Reka". */

const OPSI = [
  { nilai: "1", label: "DEMO - PT Sinar Telko (DEMO-01) · Mbak Reka" },
  { nilai: "2", label: "Ibu Rahmi-KLHK Tes Reza (CUST-0003)" },
  { nilai: "3", label: "CIFOR (CUST-0010)" },
];

function Uji({ awal = "", onPilih = () => {} }: { awal?: string; onPilih?: (v: string) => void }) {
  const [nilai, setNilai] = useState(awal);
  return (
    <>
      <label htmlFor="c">Customer</label>
      <PilihCari
        id="c"
        opsi={OPSI}
        nilai={nilai}
        onPilih={(v) => {
          setNilai(v);
          onPilih(v);
        }}
      />
    </>
  );
}

const kotak = () => screen.getByLabelText("Customer") as HTMLInputElement;

describe("PilihCari", () => {
  it("menyaring ke pilihan yang memuat huruf yang diketik, di mana pun letaknya", async () => {
    render(<Uji />);
    await userEvent.type(kotak(), "re");

    const nama = screen.getAllByRole("option").map((o) => o.textContent);
    expect(nama).toHaveLength(2);
    expect(nama.join()).not.toContain("CIFOR");
  });

  it("memilih dengan klik dan menampilkan namanya di kotak", async () => {
    const onPilih = vi.fn();
    render(<Uji onPilih={onPilih} />);
    await userEvent.type(kotak(), "cifor");
    await userEvent.click(screen.getByRole("option", { name: /CIFOR/ }));

    expect(onPilih).toHaveBeenCalledWith("3");
    expect(kotak().value).toBe("CIFOR (CUST-0010)");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("bisa dipilih dengan panah dan Enter", async () => {
    const onPilih = vi.fn();
    render(<Uji onPilih={onPilih} />);
    await userEvent.type(kotak(), "re{ArrowDown}{Enter}");

    expect(onPilih).toHaveBeenCalledWith("2");
  });

  it("kembali ke pilihan semula kalau ditinggalkan tanpa memilih", async () => {
    const onPilih = vi.fn();
    render(<Uji awal="3" onPilih={onPilih} />);
    await userEvent.clear(kotak());
    await userEvent.type(kotak(), "zzz");
    expect(screen.getByText("Tidak ada yang cocok.")).toBeTruthy();
    await userEvent.tab();

    expect(onPilih).not.toHaveBeenCalled();
    expect(kotak().value).toBe("CIFOR (CUST-0010)");
  });
});
