"use client";

import { MoveHorizontalIcon, ScanIcon, SunIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ModelViewer, type ArPlacement } from "@/components/model-viewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackEvent } from "@/lib/events";

import { DesktopQr } from "./desktop-qr";

const SKIP_WALL_GUIDE_KEY = "dan3d:skip-wall-guide";

function readSkipGuide() {
  try {
    return window.localStorage.getItem(SKIP_WALL_GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSkipGuide() {
  try {
    window.localStorage.setItem(SKIP_WALL_GUIDE_KEY, "1");
  } catch {
    // Private mode: the guide just shows again next time.
  }
}

/**
 * 3D viewer + real-size AR. Wall pieces get a short guidance screen first:
 * phones (iPhones without LiDAR above all) take long to find a plain wall or
 * door (docs/decisions.md, 2026-10-10).
 */
export function ProductViewer({
  productId,
  name,
  modelSrc,
  posterSrc,
  placement,
  pageUrl,
}: {
  productId: string;
  name: string;
  modelSrc: string;
  posterSrc?: string;
  placement: ArPlacement;
  pageUrl: string;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [skipNextTime, setSkipNextTime] = useState(false);
  const pendingOpen = useRef<(() => void) | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  // model-viewer (with three.js) is the heaviest script on the page: only load
  // it when the 3D box is about to scroll into view.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "100px 0px" },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const beforeAr = useCallback(
    (openAr: () => void) => {
      const open = () => {
        trackEvent("ar_open", productId);
        openAr();
      };
      if (placement === "wall" && !readSkipGuide()) {
        pendingOpen.current = open;
        setGuideOpen(true);
      } else open();
    },
    [placement, productId],
  );

  const continueToAr = () => {
    if (skipNextTime) saveSkipGuide();
    setGuideOpen(false);
    // Still inside the tap handler, so iOS accepts opening Quick Look.
    pendingOpen.current?.();
    pendingOpen.current = null;
  };

  return (
    <div className="space-y-4">
      <div
        ref={boxRef}
        className="relative aspect-square overflow-hidden rounded-3xl bg-secondary"
      >
        {nearViewport && (
          <ModelViewer
            src={modelSrc}
            alt={`Modelo 3D de ${name}`}
            poster={posterSrc}
            placement={placement}
            beforeAr={beforeAr}
            className="bg-secondary"
          />
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Arraste para girar a peça. No celular, toque em{" "}
        <strong className="font-medium text-foreground">
          Ver no meu espaço
        </strong>{" "}
        para ver em tamanho real
        {placement === "wall" ? ", apontando para uma parede." : "."}
      </p>
      <div className="hidden lg:block">
        <DesktopQr url={pageUrl} />
      </div>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Antes de abrir: peça de parede
            </DialogTitle>
            <DialogDescription>
              O celular precisa reconhecer a parede. Leva só alguns segundos
              seguindo estas dicas:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-4 text-sm">
            <GuideTip icon={ScanIcon}>
              Fique a cerca de <strong>1 metro</strong> da parede e aponte a
              câmera para ela.
            </GuideTip>
            <GuideTip icon={MoveHorizontalIcon}>
              Mova o celular <strong>devagar</strong>, de um lado para o outro.
            </GuideTip>
            <GuideTip icon={SunIcon}>
              Use um lugar <strong>bem iluminado</strong>. Paredes lisas e
              portas demoram mais: mire perto de um quadro, tomada ou batente.
            </GuideTip>
          </ul>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={skipNextTime}
              onChange={(event) => setSkipNextTime(event.target.checked)}
              className="size-5 accent-primary"
            />
            Não mostrar de novo
          </label>
          <button
            type="button"
            onClick={continueToAr}
            className="min-h-12 w-full rounded-full bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-espresso"
          >
            Abrir no meu espaço
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuideTip({
  icon: Icon,
  children,
}: {
  icon: typeof ScanIcon;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="size-4" />
      </span>
      <span className="pt-1.5 leading-relaxed">{children}</span>
    </li>
  );
}
