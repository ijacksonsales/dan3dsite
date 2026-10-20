import { describe, expect, it } from "vitest";

import {
  emptyQuoteItem,
  parseQuoteItems,
  quoteItemDescription,
  quoteNoticeMessage,
  quoteOrderNotes,
  quoteReplyMessage,
  validateQuoteForm,
  type QuoteFormValues,
} from "./form";
import { parseQuoteTab, quotePhotoPath } from "./status";

const TODAY = "2026-10-20";

const values = (change: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  name: "  Maria Souza ",
  phone: "(81) 98649-2071",
  city: " Recife ",
  items: [
    { description: " Anjo da guarda ", quantity: 2, height: "20", width: "" },
    emptyQuoteItem("Chaveiro com nome"),
  ],
  neededBy: "2026-11-10",
  notes: "",
  ...change,
});

describe("validateQuoteForm", () => {
  it("builds the payload with sizes in mm", () => {
    const result = validateQuoteForm(values(), TODAY);
    expect(result).toEqual({
      ok: true,
      payload: {
        name: "Maria Souza",
        phone: "5581986492071",
        city: "Recife",
        items: [
          {
            description: "Anjo da guarda",
            quantity: 2,
            height_mm: 200,
            width_mm: null,
          },
          {
            description: "Chaveiro com nome",
            quantity: 1,
            height_mm: null,
            width_mm: null,
          },
        ],
        neededBy: "2026-11-10",
        notes: null,
      },
    });
  });

  it("requires name, WhatsApp and a description for each piece", () => {
    const result = validateQuoteForm(
      values({ name: " ", phone: "", items: [emptyQuoteItem()] }),
      TODAY,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.phone).toBeTruthy();
    expect(result.errors.items[0].description).toBeTruthy();
  });

  it("rejects a bad phone, a bad size and a past date", () => {
    const result = validateQuoteForm(
      values({
        phone: "9864",
        items: [{ description: "Anjo", quantity: 1, height: "abc", width: "" }],
        neededBy: "2026-10-19",
      }),
      TODAY,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.phone).toBeTruthy();
    expect(result.errors.items[0].height).toBeTruthy();
    expect(result.errors.neededBy).toBeTruthy();
  });
});

describe("parseQuoteItems", () => {
  it("keeps valid items and drops junk", () => {
    expect(
      parseQuoteItems([
        { description: "Anjo", quantity: 2, height_mm: 200, width_mm: null },
        { description: "" },
        "x",
        { description: "Vaso", quantity: -1, height_mm: "a" },
      ]),
    ).toEqual([
      { description: "Anjo", quantity: 2, height_mm: 200, width_mm: null },
      { description: "Vaso", quantity: 1, height_mm: null, width_mm: null },
    ]);
    expect(parseQuoteItems(null)).toEqual([]);
  });
});

describe("messages", () => {
  const items = [
    { description: "Anjo", quantity: 2, height_mm: 200, width_mm: 105 },
    { description: "Chaveiro", quantity: 1, height_mm: null, width_mm: null },
  ];

  it("describes an item with its size", () => {
    expect(quoteItemDescription(items[0])).toBe(
      "Anjo (20 cm de altura × 10,5 cm de largura)",
    );
    expect(quoteItemDescription(items[1])).toBe("Chaveiro");
  });

  it("tells the store about a new request", () => {
    expect(quoteNoticeMessage({ number: 7, name: "Maria", items })).toBe(
      [
        "Olá! Sou Maria e acabei de mandar o *pedido de orçamento nº 7* pelo site.",
        "",
        "• 2× Anjo (20 cm de altura × 10,5 cm de largura)",
        "• 1× Chaveiro",
      ].join("\n"),
    );
  });

  it("greets the customer by first name", () => {
    expect(
      quoteReplyMessage({ number: 7, name: "Maria Souza", storeName: "DAN3D" }),
    ).toBe(
      "Olá, Maria! Aqui é da DAN3D. Recebemos seu pedido de orçamento nº 7 pelo site.",
    );
  });

  it("prefills the order notes", () => {
    expect(
      quoteOrderNotes({
        number: 7,
        city: "Recife",
        needed_by: "2026-11-10",
        notes: "Cor azul",
      }),
    ).toBe(
      "Pedido de orçamento nº 7 do site.\nCidade: Recife\nPrecisa para: 10/11/2026\nCor azul",
    );
  });
});

describe("status helpers", () => {
  it("parses tabs and builds photo paths", () => {
    expect(parseQuoteTab("arquivados")).toBe("arquivados");
    expect(parseQuoteTab("x")).toBe("novos");
    expect(quotePhotoPath("abc", 2)).toBe("abc/2.webp");
  });
});
