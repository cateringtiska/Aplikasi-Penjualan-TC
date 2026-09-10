import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Membongkar komponen setelah tiap tes supaya menu yang terbuka di satu tes
// tidak terbawa ke tes berikutnya.
afterEach(() => cleanup());
