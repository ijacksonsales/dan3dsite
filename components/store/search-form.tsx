import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Plain GET form to /busca: works before (and without) JavaScript. */
export function SearchForm({
  defaultValue,
  autoFocus,
  className,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form
      action="/busca"
      method="get"
      role="search"
      className={cn("relative flex w-full items-center", className)}
    >
      <label htmlFor="search-q" className="sr-only">
        Buscar peças
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Buscar peças"
        enterKeyHint="search"
        autoComplete="off"
        className="h-12 w-full rounded-full border border-input bg-card pr-14 pl-5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-0 grid size-12 place-items-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
