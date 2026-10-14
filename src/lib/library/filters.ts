export type LibraryScope = "all" | "mine" | "shared";
export type LibraryMetadata = {
  name: string;
  offeringId: number | null;
  subjectName: string | null;
  shared: boolean;
  updatedAt: number;
};
export function filterLibraryItems<T extends LibraryMetadata>(
  items: T[],
  {
    scope,
    query,
    offeringId,
  }: { scope: LibraryScope; query: string; offeringId: number | null },
): T[] {
  const search = query
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
  return items
    .filter((item) => {
      const name = item.name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase();
      return (
        (scope === "all" || item.shared === (scope === "shared")) &&
        (offeringId === null || item.offeringId === offeringId) &&
        name.includes(search)
      );
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
