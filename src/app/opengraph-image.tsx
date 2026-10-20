import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Share card for links to AIHub. Yavqo midnight surface, white type in Plus Jakarta Sans.
export const alt = "Yavqo AIHub: deploy Sunlight AI models";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files");

export default async function OpenGraphImage() {
  const [light, medium, logo] = await Promise.all([
    readFile(path.join(fontDir, "plus-jakarta-sans-latin-300-normal.woff")),
    readFile(path.join(fontDir, "plus-jakarta-sans-latin-500-normal.woff")),
    readFile(path.join(process.cwd(), "public/brand/yavqo-logo-white.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#050815",
          color: "#FFFFFF",
          fontFamily: "Jakarta",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} alt="" width={127} height={44} />
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.3)" }} />
          <div style={{ fontSize: 34, fontWeight: 500 }}>AIHub</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 80, fontWeight: 500, lineHeight: 1.08, letterSpacing: -1 }}>Deploy Sunlight AI models</div>
          <div style={{ fontSize: 36, fontWeight: 300, lineHeight: 1.3, color: "rgba(255,255,255,0.72)", maxWidth: 900 }}>
            Your own OpenAI-compatible endpoint. Pay only for the tokens you use.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {["Sunlight 2 Pro", "Per-token billing", "Rate limits per deployment"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: 100,
                border: "2px solid rgba(255,255,255,0.18)",
                fontSize: 24,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: light, weight: 300, style: "normal" },
        { name: "Jakarta", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
