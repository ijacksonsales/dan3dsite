import { describe, expect, it } from "vitest";

import { addDays, daysBetween, formatDay, storeToday } from "@/lib/dates";

import { orderMessage } from "./message";
import { dueLabel, nextStep, parseOrderTab } from "./status";
import { orderTotals } from "./totals";

const items = [
  {
    description: "Nossa Senhora Aparecida",
    quantity: 2,
    unit_price_cents: 3190,
    unit_cost_cents: 1652,
  },
  {
    description: "Chaveiro",
    quantity: 1,
    unit_price_cents: 1500,
    unit_cost_cents: null,
  },
];

describe("orderTotals", () => {
  it("adds items, discount, shipping and payments", () => {
    const totals = orderTotals({
      items,
      discount_cents: 380,
      shipping_cents: 1000,
      payments: [{ amount_cents: 4000 }],
    });
    expect(totals.subtotal).toBe(7880);
    expect(totals.total).toBe(7880 - 380 + 1000);
    expect(totals.cost).toBe(3304);
    expect(totals.costKnown).toBe(false);
    expect(totals.profit).toBe(7880 - 380 - 3304);
    expect(totals.paid).toBe(4000);
    expect(totals.balance).toBe(8500 - 4000);
  });

  it("never lets the discount pass the subtotal or the balance go negative", () => {
    const totals = orderTotals({
      items: [items[0]],
      discount_cents: 99_999,
      shipping_cents: 0,
      payments: [{ amount_cents: 100 }],
    });
    expect(totals.discount).toBe(6380);
    expect(totals.total).toBe(0);
    expect(totals.balance).toBe(0);
  });

  it("knows the cost when every item has one", () => {
    expect(
      orderTotals({ items: [items[0]], discount_cents: 0, shipping_cents: 0 })
        .costKnown,
    ).toBe(true);
  });
});

describe("nextStep", () => {
  it("follows the normal path", () => {
    expect(nextStep("quote")).toEqual({
      status: "confirmed",
      label: "Cliente aprovou",
    });
    expect(nextStep("ready")?.status).toBe("delivered");
    expect(nextStep("delivered")).toBeNull();
    expect(nextStep("canceled")).toBeNull();
  });
});

describe("parseOrderTab", () => {
  it("falls back to orders in progress", () => {
    expect(parseOrderTab("entregues")).toBe("entregues");
    expect(parseOrderTab("x")).toBe("andamento");
    expect(parseOrderTab(undefined)).toBe("andamento");
  });
});

describe("dueLabel", () => {
  const today = "2026-10-16";
  it("describes the deadline", () => {
    expect(dueLabel("confirmed", "2026-10-14", today)).toEqual({
      text: "Atrasado 2 dias",
      tone: "late",
    });
    expect(dueLabel("confirmed", "2026-10-15", today)?.text).toBe(
      "Atrasado 1 dia",
    );
    expect(dueLabel("ready", "2026-10-16", today)).toEqual({
      text: "Entrega hoje",
      tone: "soon",
    });
    expect(dueLabel("quote", "2026-10-17", today)?.text).toBe("Entrega amanhã");
    expect(dueLabel("quote", "2026-10-19", today)?.text).toBe(
      "Entrega em 3 dias",
    );
    expect(dueLabel("quote", "2026-10-28", today)).toEqual({
      text: "Entrega 28/10",
      tone: "normal",
    });
  });

  it("is empty for closed orders or without a date", () => {
    expect(dueLabel("delivered", "2026-10-01", today)).toBeNull();
    expect(dueLabel("confirmed", null, today)).toBeNull();
  });
});

describe("dates", () => {
  it("formats and counts days", () => {
    expect(formatDay("2026-10-20")).toBe("20/10/2026");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("uses Brasília for today", () => {
    // 02:00 UTC is still the previous day in Brasília (UTC−3).
    expect(storeToday(new Date("2026-10-17T02:00:00Z"))).toBe("2026-10-16");
  });
});

describe("orderMessage", () => {
  it("summarises the order for WhatsApp", () => {
    const message = orderMessage({
      number: 12,
      status: "confirmed",
      customerName: "Maria da Silva",
      storeName: "DAN3D",
      dueDate: "2026-10-20",
      items,
      discount_cents: 380,
      shipping_cents: 1000,
      payments: [{ amount_cents: 4000 }],
    });
    expect(message).toBe(
      [
        "Olá, Maria! Aqui é da DAN3D, seu pedido está confirmado:",
        "",
        "*Pedido nº 12*",
        "• 2× Nossa Senhora Aparecida: R$ 63,80",
        "• 1× Chaveiro: R$ 15,00",
        "",
        "Subtotal: R$ 78,80",
        "Desconto: −R$ 3,80",
        "Frete: R$ 10,00",
        "*Total: R$ 85,00*",
        "Já pago: R$ 40,00",
        "Falta pagar: R$ 45,00",
        "",
        "Previsão de entrega: 20/10/2026",
      ].join("\n"),
    );
  });

  it("keeps a quote short", () => {
    const message = orderMessage({
      number: 3,
      status: "quote",
      customerName: "João",
      storeName: "DAN3D",
      dueDate: null,
      items: [items[0]],
      discount_cents: 0,
      shipping_cents: 0,
    });
    expect(message).toBe(
      [
        "Olá, João! Aqui é da DAN3D, segue o orçamento que combinamos:",
        "",
        "*Orçamento nº 3*",
        "• 2× Nossa Senhora Aparecida: R$ 63,80",
        "",
        "*Total: R$ 63,80*",
      ].join("\n"),
    );
  });
});
