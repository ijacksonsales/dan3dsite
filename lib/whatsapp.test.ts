import { describe, expect, it } from "vitest";

import { isValidWhatsAppNumber, orderMessage, whatsappLink } from "./whatsapp";

describe("isValidWhatsAppNumber", () => {
  it("accepts 55 + area code + 8 or 9 digits", () => {
    expect(isValidWhatsAppNumber("5581987654321")).toBe(true);
    expect(isValidWhatsAppNumber("558132345678")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidWhatsAppNumber(null)).toBe(false);
    expect(isValidWhatsAppNumber("81987654321")).toBe(false);
    expect(isValidWhatsAppNumber("+55 81 98765-4321")).toBe(false);
  });
});

describe("whatsapp order link", () => {
  const message = orderMessage({
    name: "Nossa Senhora Aparecida",
    url: "https://dan3d.jailabs.com.br/p/nossa-senhora-aparecida",
    height_mm: 150,
    width_mm: 60,
    depth_mm: 45,
  });

  it("includes the piece name, measures and link", () => {
    expect(message).toBe(
      [
        "Olá! Tenho interesse nesta peça: *Nossa Senhora Aparecida*",
        "Altura 15 cm · Largura 6 cm · Profundidade 4,5 cm",
        "https://dan3d.jailabs.com.br/p/nossa-senhora-aparecida",
      ].join("\n"),
    );
  });

  it("encodes the message in the wa.me URL", () => {
    const link = whatsappLink("5581987654321", message);
    expect(link.startsWith("https://wa.me/5581987654321?text=")).toBe(true);
    const text = new URL(link).searchParams.get("text");
    expect(text).toBe(message);
  });
});
