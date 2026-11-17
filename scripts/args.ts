// A script's `--name value` flags. A flag given with no value, or followed straight by another flag, is refused rather than read as empty.

/** The value after `name`, or undefined when the flag is not given. */
export function flagValue(args: readonly string[], name: string): string | undefined {
  return flagValues(args, name)[0];
}

/** Every value of a flag given more than once (`--desktop a --desktop b`), in order. */
export function flagValues(args: readonly string[], name: string): string[] {
  const values: string[] = [];
  args.forEach((arg, at) => {
    if (arg !== name) return;
    const value = args[at + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
    values.push(value);
  });
  return values;
}

/** The value after `name`; the flag must be given. */
export function requiredFlag(args: readonly string[], name: string): string {
  const value = flagValue(args, name);
  if (value === undefined) throw new Error(`${name} needs a value`);
  return value;
}
