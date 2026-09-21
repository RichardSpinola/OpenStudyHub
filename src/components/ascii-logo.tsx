export function AsciiLogo({ value }: { value: string }) {
  return (
    <pre className="ascii-logo" aria-label="OpenStudyHub">
      {value}
    </pre>
  );
}
