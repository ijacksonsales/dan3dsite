import type { ModelInfo } from "./types";

export interface Choice {
  key: string;
  label: string;
  objectIds: string[];
}

/** "Everything" or whole plates first, then single pieces. */
export function selectionChoices(info: ModelInfo): Choice[] {
  const count = (n: number) => (n === 1 ? "1 peça" : `${n} peças`);
  const choices: Choice[] = [];
  if (info.plates.length > 1) {
    for (const plate of info.plates)
      choices.push({
        key: `plate-${plate.id}`,
        label: `${plate.name} (${count(plate.objectIds.length)})`,
        objectIds: plate.objectIds,
      });
  } else if (info.objects.length > 1) {
    choices.push({
      key: "all",
      label: `Tudo (${count(info.objects.length)})`,
      objectIds: info.objects.map((object) => object.id),
    });
  }
  for (const object of info.objects)
    choices.push({
      key: `object-${object.id}`,
      label: object.plate
        ? `${object.name} · placa ${object.plate}`
        : object.name,
      objectIds: [object.id],
    });
  return choices;
}

export const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
