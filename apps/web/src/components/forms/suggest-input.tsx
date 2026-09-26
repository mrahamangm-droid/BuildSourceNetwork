import { useId } from "react";
import { Input } from "@/components/ui";

/**
 * Text input with a type-ahead list of suggestions. Anything can still be typed, so a catalogue
 * is never blocked by a value the list did not foresee.
 */
export function SuggestInput({
  name,
  options,
  defaultValue,
  placeholder,
  maxLength,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string | null;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <>
      <Input
        name={name}
        list={id}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
      />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
