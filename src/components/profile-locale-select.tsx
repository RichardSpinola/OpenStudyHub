import { languageOptions, type UiLanguage } from "@/lib/ui-language";

export function ProfileLocaleSelect({
  label,
  locale,
}: {
  label: string;
  locale: UiLanguage;
}) {
  return (
    <>
      <label htmlFor="profile-locale">{label}</label>
      <select
        id="profile-locale"
        key={locale}
        name="locale"
        defaultValue={locale}
      >
        {languageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
