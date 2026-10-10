import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </>
  );
}
