import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Share card for links to AIHub. Clean light surface, Plus Jakarta Sans.
export const alt = "Yavqo AIHub: deploy Sunlight 2.1 and 2.1 Pro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files");

export default async function OpenGraphImage() {
  const [regular, medium, logo] = await Promise.all([
    readFile(path.join(fontDir, "plus-jakarta-sans-latin-400-normal.woff")),
    readFile(path.join(fontDir, "plus-jakarta-sans-latin-500-normal.woff")),
    readFile(path.join(process.cwd(), "public/brand/yavqo-logo-ink.png")),
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
          background: "#FFFFFF",
          color: "#111418",
          fontFamily: "Jakarta",
          borderTop: "8px solid #1A73E8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} alt="" width={127} height={44} />
          <div style={{ width: 1, height: 32, background: "#DADCE0" }} />
          <div style={{ fontSize: 32, fontWeight: 500, color: "#5F6368" }}>AIHub</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 500, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 960 }}>
            Sunlight 2.1 and 2.1 Pro, deployed per project
          </div>
          <div style={{ fontSize: 30, fontWeight: 400, lineHeight: 1.4, color: "#5F6368", maxWidth: 880 }}>
            OpenAI-compatible deployment endpoints, project-isolated API keys and monthly EUR billing.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid #E0E3E7",
            fontSize: 22,
            color: "#5F6368",
          }}
        >
          <div>sunlight-2.1 · €0.50 / €2.00 per 1M</div>
          <div>sunlight-2.1-pro · €2.50 / €10.00 per 1M</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: regular, weight: 400, style: "normal" },
        { name: "Jakarta", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
