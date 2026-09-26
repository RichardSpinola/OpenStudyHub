import { UiCopy } from "@/components/ui-language-provider";
export default function Loading() {
  return (
    <div className="v2-console" role="status">
      <UiCopy pt="Carregando administração…" en="Loading administration…" />
    </div>
  );
}
