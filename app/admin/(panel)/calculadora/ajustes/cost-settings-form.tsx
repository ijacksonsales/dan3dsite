"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Field,
  StickyActions,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import type { CostSettings } from "@/lib/costs/calculate";
import {
  formatMoneyInput,
  formatNumberInput,
  parseMoneyInput,
  parseNumberInput,
} from "@/lib/costs/inputs";
import { createClient } from "@/lib/supabase/client";

type Key = keyof CostSettings;

interface FieldSpec {
  key: Key;
  label: string;
  hint: string;
  kind: "money" | "number";
  /** Whole numbers only (the column is an int). */
  integer?: boolean;
  min?: number;
  max?: number;
}

const GROUPS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: "Filamento e energia",
    fields: [
      {
        key: "filament_price_per_kg_cents",
        label: "Preço do rolo de 1 kg (R$)",
        hint: "O filamento que vocês mais usam. Dá para mudar em cada cálculo.",
        kind: "money",
      },
      {
        key: "energy_price_per_kwh_cents",
        label: "Energia (R$ por kWh)",
        hint: "Veja na conta de luz, com impostos.",
        kind: "money",
      },
      {
        key: "printer_power_w",
        label: "Consumo médio da impressora (W)",
        hint: "A Bambu A1 gasta cerca de 150 W.",
        kind: "number",
        integer: true,
        max: 10_000,
      },
    ],
  },
  {
    title: "Máquina",
    fields: [
      {
        key: "machine_price_cents",
        label: "Preço da impressora (R$)",
        hint: "O valor pago. Entra no preço aos poucos, por hora de uso.",
        kind: "money",
      },
      {
        key: "machine_life_hours",
        label: "Vida útil (horas)",
        hint: "Quantas horas ela deve imprimir até precisar trocar.",
        kind: "number",
        integer: true,
        min: 1,
        max: 1_000_000,
      },
      {
        key: "maintenance_cents",
        label: "Manutenção durante a vida útil (R$)",
        hint: "Bicos, placa, correias, graxa etc. Também entra por hora.",
        kind: "money",
      },
    ],
  },
  {
    title: "Trabalho e lucro",
    fields: [
      {
        key: "labor_rate_per_hour_cents",
        label: "Valor da hora de trabalho (R$)",
        hint: "Quanto vale uma hora do trabalho manual (acabamento).",
        kind: "money",
      },
      {
        key: "failure_percent",
        label: "Falhas (%)",
        hint: "Uma reserva para impressões que dão errado.",
        kind: "number",
        max: 100,
      },
      {
        key: "margin_percent",
        label: "Margem de lucro (%)",
        hint: "Sobre o custo de produção. 100% = o preço é o dobro do custo (sem contar embalagem e materiais).",
        kind: "number",
        max: 1000,
      },
    ],
  },
];

const FIELDS = GROUPS.flatMap((group) => group.fields);

function format(spec: FieldSpec, value: number) {
  return spec.kind === "money"
    ? formatMoneyInput(value)
    : formatNumberInput(value) || "0";
}

function parse(spec: FieldSpec, text: string) {
  if (spec.kind === "money") return parseMoneyInput(text);
  const parsed = parseNumberInput(text, {
    max: spec.max,
    error: `Digite um número${spec.max != null ? ` até ${formatNumberInput(spec.max)}` : ""}.`,
  });
  if (!parsed.ok) return parsed;
  if (spec.integer && !Number.isInteger(parsed.value))
    return { ok: false as const, error: "Digite um número inteiro." };
  if (spec.min != null && parsed.value < spec.min)
    return { ok: false as const, error: `O mínimo é ${spec.min}.` };
  return parsed;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function CostSettingsForm({ initial }: { initial: CostSettings }) {
  const router = useRouter();
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        FIELDS.map((spec) => [spec.key, format(spec, initial[spec.key])]),
      ) as Record<Key, string>,
  );
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const parsed = FIELDS.map((spec) => ({
    spec,
    result: parse(spec, values[spec.key]),
  }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsed.some(({ result }) => !result.ok)) {
      setShowErrors(true);
      setStatus({
        kind: "error",
        message: "Confira os campos marcados em vermelho.",
      });
      return;
    }
    setStatus({ kind: "saving" });
    const update = Object.fromEntries(
      parsed.map(({ spec, result }) => [
        spec.key,
        result.ok ? result.value : 0,
      ]),
    ) as unknown as CostSettings;
    const { data, error } = await createClient()
      .from("cost_settings")
      .update(update)
      .eq("id", 1)
      .select("id");
    if (error || !data?.length) {
      setStatus({
        kind: "error",
        message: "Não foi possível salvar. Confira a internet e tente de novo.",
      });
      return;
    }
    setShowErrors(false);
    setStatus({ kind: "saved" });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-4">
          <h2 className="font-heading text-xl font-medium">{group.title}</h2>
          {group.fields.map((spec) => {
            const result = parsed.find(
              (item) => item.spec.key === spec.key,
            )!.result;
            const error = showErrors && !result.ok ? result.error : null;
            return (
              <Field
                key={spec.key}
                label={spec.label}
                htmlFor={spec.key}
                hint={spec.hint}
                error={error}
              >
                <TextInput
                  id={spec.key}
                  inputMode="decimal"
                  value={values[spec.key]}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [spec.key]: event.target.value,
                    }));
                    if (status.kind !== "saving") setStatus({ kind: "idle" });
                  }}
                  onBlur={() => {
                    if (result.ok)
                      setValues((current) => ({
                        ...current,
                        [spec.key]: format(spec, result.value),
                      }));
                  }}
                  aria-invalid={!!error}
                />
              </Field>
            );
          })}
        </section>
      ))}

      <StickyActions>
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`min-w-0 flex-1 text-base empty:hidden ${status.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {status.kind === "saved" && "Valores salvos."}
          {status.kind === "error" && status.message}
        </p>
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className={`${primaryButtonClassName} sm:w-auto sm:min-w-48`}
        >
          {status.kind === "saving" && (
            <LoaderCircleIcon className="size-5 animate-spin" />
          )}
          {status.kind === "saving"
            ? "Salvando…"
            : status.kind === "saved"
              ? "Salvo ✓"
              : "Salvar valores"}
        </button>
      </StickyActions>
    </form>
  );
}
