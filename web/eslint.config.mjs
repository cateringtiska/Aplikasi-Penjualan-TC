import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      /*
       * Melarang prop onSelect pada JSX.
       *
       * Komponen menu di sini memakai Base UI, yang menutup item lewat
       * onClick — bukan onSelect seperti Radix. Masalahnya, onSelect ADALAH
       * atribut DOM React yang sah (untuk seleksi teks), jadi TypeScript
       * menerimanya tanpa keluhan dan kodenya terkompilasi bersih.
       *
       * Akibatnya seluruh menu tindakan per baris dan tombol Keluar pernah
       * mati diam-diam: tidak ada galat, tidak ada log, tombolnya hanya tidak
       * melakukan apa pun. Aturan ini membuat kekeliruan itu berhenti di lint.
       *
       * Kalau suatu saat benar-benar butuh menangkap seleksi teks, matikan
       * aturannya per baris dengan komentar eslint-disable-next-line.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='onSelect']",
          message:
            "Komponen menu memakai Base UI: pakai onClick, bukan onSelect. onSelect lolos TypeScript tetapi tidak pernah terpanggil.",
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
