export type ConverterErrorCode =
  "unsupported-format" | "invalid-file" | "empty-model" | "unknown-object";

const MESSAGES: Record<ConverterErrorCode, string> = {
  "unsupported-format":
    "Este tipo de arquivo não é aceito. Use um arquivo STL ou 3MF exportado do fatiador.",
  "invalid-file":
    "Não consegui ler este arquivo. Ele pode estar corrompido. Tente exportar de novo do fatiador.",
  "empty-model":
    "O arquivo não tem nenhuma peça para mostrar. Confira se a peça está na placa antes de exportar.",
  "unknown-object":
    "A peça escolhida não foi encontrada no arquivo. Abra o arquivo de novo e escolha outra vez.",
};

/** Error with a pt-BR message that can be shown to the admin as is. */
export class ConverterError extends Error {
  readonly code: ConverterErrorCode;

  constructor(code: ConverterErrorCode, options?: { cause?: unknown }) {
    super(MESSAGES[code], options);
    this.name = "ConverterError";
    this.code = code;
  }
}
