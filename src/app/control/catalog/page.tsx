import { redirect } from "next/navigation";

export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ institution?: string }>;
}) {
  const { institution } = await searchParams;
  const id = Number(institution);
  redirect(
    Number.isSafeInteger(id) && id > 0
      ? `/control/institutions/${id}?area=subjects`
      : "/control/institutions",
  );
}
