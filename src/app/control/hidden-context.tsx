export function HiddenContext({
  returnTo,
  ...fields
}: {
  returnTo: string;
  [key: string]: string | number;
}) {
  return (
    <>
      <input type="hidden" name="returnTo" value={returnTo} />
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
    </>
  );
}
