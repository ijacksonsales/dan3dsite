"use client";

import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Alert, Field, TextInput } from "@/components/admin/form";
import {
  calculateCost,
  emptyCostInputs,
  materialCost,
  type CostBreakdown,
  type CostInputs,
  type CostSettings,
} from "@/lib/costs/calculate";
import type { AdminMaterial } from "@/lib/costs/data";
import {
  formatMoney,
  formatMoneyInput,
  formatNumberInput,
  parseMoneyInput,
  parseNumberInput,
} from "@/lib/costs/inputs";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

// Calculator fields shared by the calculator page and the "custom piece"
// window of an order: state + parsing in `useCostFields`, the inputs in
// <CostFields>, the step-by-step result in <CostBreakdownList>.

interface Fields {
  weight: string;
  hours: string;
  minutes: string;
  finishing: string;
  filament: string;
}

type MaterialState = Record<string, { used: boolean; quantity: string }>;

function toState(
  inputs: CostInputs,
  settings: CostSettings,
  materials: AdminMaterial[],
): { fields: Fields; used: MaterialState } {
  const used: MaterialState = {};
  for (const material of materials) {
    const chosen = inputs.materials.find(
      ({ materialId }) => materialId === material.id,
    );
    used[material.id] = {
      used: !!chosen,
      quantity: formatNumberInput(
        chosen?.quantity ?? material.default_quantity,
      ),
    };
  }
  return {
    fields: {
      weight: formatNumberInput(inputs.weightG),
      hours: formatNumberInput(inputs.printHours),
      minutes: formatNumberInput(inputs.printMinutes),
      finishing: formatNumberInput(inputs.finishingMinutes),
      filament: formatMoneyInput(
        inputs.filamentPricePerKgCents ?? settings.filament_price_per_kg_cents,
      ),
    },
    used,
  };
}

export function useCostFields(
  settings: CostSettings,
  materials: AdminMaterial[],
  initialInputs: CostInputs | null,
  onEdit?: () => void,
) {
  const [initial] = useState(() =>
    toState(initialInputs ?? emptyCostInputs(materials), settings, materials),
  );
  const [fields, setFields] = useState(initial.fields);
  const [used, setUsed] = useState(initial.used);

  const weight = parseNumberInput(fields.weight, {
    max: 100_000,
    error: "Digite o peso em gramas, por exemplo 70.",
  });
  const hours = parseNumberInput(fields.hours, {
    max: 10_000,
    error: "Digite as horas, por exemplo 3.",
  });
  const minutes = parseNumberInput(fields.minutes, {
    max: 100_000,
    error: "Digite os minutos, por exemplo 30.",
  });
  const finishing = parseNumberInput(fields.finishing, {
    max: 100_000,
    error: "Digite os minutos, por exemplo 10.",
  });
  const filament = parseMoneyInput(fields.filament);
  const quantities = materials.map((material) => ({
    material,
    used: used[material.id]?.used ?? false,
    parsed: parseNumberInput(used[material.id]?.quantity ?? "", {
      max: 100_000,
      error: "Quantidade inválida.",
    }),
  }));

  const valid =
    weight.ok &&
    hours.ok &&
    minutes.ok &&
    finishing.ok &&
    filament.ok &&
    quantities.every(({ used, parsed }) => !used || parsed.ok);

  const inputs: CostInputs | null = valid
    ? {
        weightG: weight.value,
        printHours: hours.value,
        printMinutes: minutes.value,
        finishingMinutes: finishing.value,
        filamentPricePerKgCents:
          filament.value === settings.filament_price_per_kg_cents
            ? null
            : filament.value,
        materials: quantities.flatMap(({ material, used, parsed }) =>
          used && parsed.ok && parsed.value > 0
            ? [{ materialId: material.id, quantity: parsed.value }]
            : [],
        ),
      }
    : null;
  const result = inputs ? calculateCost(settings, inputs, materials) : null;

  return {
    settings,
    materials,
    fields,
    used,
    parsed: { weight, hours, minutes, finishing, filament },
    quantities,
    inputs,
    result,
    setField(name: keyof Fields, value: string) {
      setFields((current) => ({ ...current, [name]: value }));
      onEdit?.();
    },
    setMaterial(id: string, value: { used: boolean; quantity: string }) {
      setUsed((current) => ({ ...current, [id]: value }));
      onEdit?.();
    },
    /** Replaces everything with saved inputs (e.g. another product's). */
    load(saved: CostInputs) {
      const state = toState(saved, settings, materials);
      setFields(state.fields);
      setUsed(state.used);
    },
  };
}

export type CostFieldsState = ReturnType<typeof useCostFields>;

export function CostFields({
  state,
  idPrefix = "",
}: {
  state: CostFieldsState;
  /** Keeps ids unique when the fields appear twice on a page. */
  idPrefix?: string;
}) {
  const { settings, materials, fields, used, parsed, quantities } = state;
  const { weight, hours, minutes, finishing, filament } = parsed;
  const id = (name: string) => `${idPrefix}${name}`;
  const packaging = quantities.filter(
    ({ material }) => material.category === "packaging",
  );
  const extras = quantities.filter(
    ({ material }) => material.category === "extra",
  );

  return (
    <>
      <CostSection
        title="Impressão"
        hint="Valores do fatiador (Bambu Studio ou Handy)."
      >
        <Field
          label="Peso da peça (g)"
          htmlFor={id("weight")}
          error={weight.ok ? null : weight.error}
        >
          <TextInput
            id={id("weight")}
            inputMode="decimal"
            value={fields.weight}
            onChange={(event) => state.setField("weight", event.target.value)}
            placeholder="70"
            aria-invalid={!weight.ok}
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-base font-medium">Tempo de impressão</legend>
          <div className="grid grid-cols-2 gap-3">
            <UnitInput
              id={id("hours")}
              unit="h"
              label="Horas"
              value={fields.hours}
              invalid={!hours.ok}
              onChange={(value) => state.setField("hours", value)}
              placeholder="2"
            />
            <UnitInput
              id={id("minutes")}
              unit="min"
              label="Minutos"
              value={fields.minutes}
              invalid={!minutes.ok}
              onChange={(value) => state.setField("minutes", value)}
              placeholder="30"
            />
          </div>
          {(!hours.ok || !minutes.ok) && (
            <p className="text-sm text-destructive">
              {!hours.ok ? hours.error : !minutes.ok && minutes.error}
            </p>
          )}
        </fieldset>

        <Field
          label="Preço do filamento (R$ por kg)"
          htmlFor={id("filament")}
          error={filament.ok ? null : filament.error}
          hint={`O padrão é ${formatPrice(settings.filament_price_per_kg_cents)}. Mude só se esta peça usa um filamento de outro preço.`}
        >
          <TextInput
            id={id("filament")}
            inputMode="decimal"
            value={fields.filament}
            onChange={(event) => state.setField("filament", event.target.value)}
            aria-invalid={!filament.ok}
          />
        </Field>
      </CostSection>

      <CostSection title="Acabamento">
        <Field
          label="Tempo de trabalho manual (min)"
          htmlFor={id("finishing")}
          error={finishing.ok ? null : finishing.error}
          hint={`Tirar suportes, lixar, pintar, montar. A hora vale ${formatPrice(settings.labor_rate_per_hour_cents)}.`}
        >
          <TextInput
            id={id("finishing")}
            inputMode="decimal"
            value={fields.finishing}
            onChange={(event) =>
              state.setField("finishing", event.target.value)
            }
            placeholder="10"
            aria-invalid={!finishing.ok}
          />
        </Field>
      </CostSection>

      <CostSection
        title="Embalagem e materiais"
        hint="Entram pelo valor de custo, sem lucro em cima. Marque o que vai nesta peça."
      >
        {materials.length === 0 ? (
          <p className="text-base text-muted-foreground">
            Nenhum material cadastrado.
          </p>
        ) : (
          <>
            <MaterialGroup
              title="Embalagem"
              items={packaging}
              used={used}
              idPrefix={idPrefix}
              onChange={state.setMaterial}
            />
            <MaterialGroup
              title="Materiais extras"
              items={extras}
              used={used}
              idPrefix={idPrefix}
              onChange={state.setMaterial}
            />
          </>
        )}
        <Link
          href="/admin/calculadora/ajustes#materiais"
          className="inline-flex min-h-12 items-center gap-2 rounded-full text-base font-medium text-primary underline-offset-4 hover:underline"
        >
          <PencilIcon className="size-4" />
          Cadastrar ou mudar materiais
        </Link>
      </CostSection>
    </>
  );
}

export function CostSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-medium">{title}</h2>
        {hint && <p className="text-base text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function CostBreakdownList({
  result,
  settings,
  weightG,
}: {
  result: CostBreakdown | null;
  settings: CostSettings;
  weightG: number;
}) {
  if (!result)
    return (
      <Alert>Corrija os campos marcados em vermelho para ver o preço.</Alert>
    );
  return (
    <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-base">
      <Row
        label={`Filamento (${formatNumberInput(weightG) || 0} g)`}
        value={result.filament}
      />
      <Row label="Energia" value={result.energy} />
      <Row label="Desgaste da máquina" value={result.depreciation} />
      <Row label="Manutenção" value={result.maintenance} />
      <Row
        label={`Falhas (${formatNumberInput(settings.failure_percent)}%)`}
        value={result.failures}
      />
      <Row label="Acabamento" value={result.finishing} />
      <Row label="Custo de produção" value={result.base} strong />
      <Row
        label={`Lucro (${formatNumberInput(settings.margin_percent)}% sobre a produção)`}
        value={result.profit}
      />
      <Row label="Embalagem (repasse)" value={result.packaging} />
      <Row label="Materiais extras (repasse)" value={result.extras} />
      <Row label="Preço calculado" value={result.price} strong />
      <Row
        label="Preço sugerido (final ,90)"
        value={result.roundedPrice}
        strong
      />
      <Row label="Custo total" value={result.cost} />
      <Row
        label="Lucro com o preço sugerido"
        value={result.profitAtRoundedPrice}
        strong
      />
    </dl>
  );
}

function UnitInput({
  id,
  unit,
  label,
  value,
  invalid,
  onChange,
  placeholder,
}: {
  id: string;
  unit: string;
  label: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <TextInput
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid}
        className="pr-14"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

function MaterialGroup({
  title,
  items,
  used,
  idPrefix,
  onChange,
}: {
  title: string;
  items: {
    material: AdminMaterial;
    parsed: ReturnType<typeof parseNumberInput>;
  }[];
  used: MaterialState;
  idPrefix: string;
  onChange: (id: string, value: { used: boolean; quantity: string }) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-base font-medium">{title}</h3>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {items.map(({ material, parsed }) => {
          const state = used[material.id] ?? { used: false, quantity: "1" };
          const unitCost = materialCost(material, 1);
          const quantityId = `${idPrefix}qty-${material.id}`;
          return (
            <li key={material.id} className="flex items-center gap-3 px-3 py-2">
              <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={state.used}
                  onChange={(event) =>
                    onChange(material.id, {
                      ...state,
                      used: event.target.checked,
                    })
                  }
                  className="size-6 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">
                    {material.name}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatMoney(unitCost)} cada
                    {state.used && parsed.ok && parsed.value > 0
                      ? ` · ${formatMoney(materialCost(material, parsed.value))} nesta peça`
                      : ""}
                  </span>
                </span>
              </label>
              {state.used && (
                <div className="w-24 shrink-0">
                  <label htmlFor={quantityId} className="sr-only">
                    Quantidade de {material.name}
                  </label>
                  <TextInput
                    id={quantityId}
                    inputMode="decimal"
                    value={state.quantity}
                    onChange={(event) =>
                      onChange(material.id, {
                        ...state,
                        quantity: event.target.value,
                      })
                    }
                    aria-invalid={!parsed.ok}
                    className="text-center"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-4 py-3",
        strong && "font-medium",
      )}
    >
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}
