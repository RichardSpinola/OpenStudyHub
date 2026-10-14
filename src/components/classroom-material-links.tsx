import { UiCopy } from "./ui-language-provider";
export function ClassroomMaterialLinks({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return null;
  const links = value.slice(0, 20).flatMap((item: unknown) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("url" in item) ||
      typeof item.url !== "string"
    )
      return [];
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:") return [];
      return [
        {
          url: url.toString(),
          title:
            "title" in item && typeof item.title === "string" ? item.title : "",
        },
      ];
    } catch {
      return [];
    }
  });
  return links.length ? (
    <ul className="classroom-attachments">
      {links.map((link, i) => (
        <li key={i}>
          <a href={link.url} target="_blank" rel="noreferrer">
            {link.title || <UiCopy pt="Abrir material" en="Open material" />} ↗
          </a>
        </li>
      ))}
    </ul>
  ) : null;
}
