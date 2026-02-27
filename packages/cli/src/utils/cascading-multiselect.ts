import type { SourceProfileInfo } from "@baton-dx/core";
import { MultiSelectPrompt } from "@clack/core";
import {
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  limitOptions,
  symbol,
} from "@clack/prompts";
import color from "picocolors";
import { buildChildrenMap, buildParentMap, getAncestors, getDescendants } from "./profile-tree.js";

/**
 * Pure cascading logic — exported for unit testing without UI dependencies.
 *
 * Given a previous and current set of selected values, determines which
 * values should actually be selected after applying cascade rules:
 * - SELECT: ancestors are auto-selected
 * - DESELECT: descendants are auto-deselected
 */
export function applyCascade(
  previousValues: string[],
  currentValues: string[],
  parentMap: Map<string, string>,
  childrenMap: Map<string, string[]>,
  nameToValue: Map<string, string>,
  valueToName: Map<string, string>,
): string[] {
  const prevSet = new Set(previousValues);
  const currSet = new Set(currentValues);

  // Find newly added values
  for (const val of currentValues) {
    if (!prevSet.has(val)) {
      const name = valueToName.get(val);
      if (!name) continue;
      // Select ancestors
      for (const ancestor of getAncestors(name, parentMap)) {
        const ancestorVal = nameToValue.get(ancestor);
        if (ancestorVal !== undefined) {
          currSet.add(ancestorVal);
        }
      }
    }
  }

  // Find newly removed values
  for (const val of previousValues) {
    if (!currSet.has(val)) {
      const name = valueToName.get(val);
      if (!name) continue;
      // Deselect descendants
      for (const descendant of getDescendants(name, childrenMap)) {
        const descendantVal = nameToValue.get(descendant);
        if (descendantVal !== undefined) {
          currSet.delete(descendantVal);
        }
      }
    }
  }

  return [...currSet];
}

interface CascadingOption {
  value: string;
  label?: string;
  hint?: string;
  name: string;
  disabled?: boolean;
}

interface CascadingMultiselectConfig {
  message: string;
  options: CascadingOption[];
  profiles: SourceProfileInfo[];
  required?: boolean;
  maxItems?: number;
  initialValues?: string[];
}

/**
 * A multiselect prompt with cascading behavior:
 * - Selecting a profile auto-selects all its ancestors (extends chain)
 * - Deselecting a profile auto-deselects all its descendants
 */
export async function cascadingMultiselect(
  config: CascadingMultiselectConfig,
): Promise<string[] | symbol> {
  const { message, options, profiles, required = true, maxItems, initialValues } = config;

  const parentMap = buildParentMap(profiles);
  const childrenMap = buildChildrenMap(profiles);

  // Build bidirectional name <-> value maps
  const nameToValue = new Map<string, string>();
  const valueToName = new Map<string, string>();
  for (const opt of options) {
    nameToValue.set(opt.name, opt.value);
    valueToName.set(opt.value, opt.name);
  }

  const prompt = new MultiSelectPrompt({
    options,
    required,
    initialValues,
    validate(value) {
      if (required && (value === undefined || value.length === 0)) {
        return "Please select at least one profile.";
      }
    },
    render() {
      const title = `${color.gray(S_BAR)}\n${symbol(this.state)}  ${message}\n`;

      const styleOption = (opt: CascadingOption, active: boolean): string => {
        const selected = (this.value ?? []).includes(opt.value);
        const label = opt.label ?? String(opt.value ?? "");
        const hintStr = opt.hint && active ? color.dim(` (${opt.hint})`) : "";

        if (opt.disabled) {
          return `${color.gray(S_CHECKBOX_INACTIVE)} ${color.strikethrough(color.gray(label))}`;
        }

        const checkbox = active
          ? selected
            ? color.green(S_CHECKBOX_SELECTED)
            : color.cyan(S_CHECKBOX_ACTIVE)
          : selected
            ? color.green(S_CHECKBOX_SELECTED)
            : color.dim(S_CHECKBOX_INACTIVE);

        return active ? `${checkbox} ${label}${hintStr}` : `${checkbox} ${color.dim(label)}`;
      };

      switch (this.state) {
        case "submit": {
          const selectedLabels = this.options
            .filter((o: CascadingOption) => (this.value ?? []).includes(o.value))
            .map((o: CascadingOption) => o.label ?? String(o.value));
          const summary =
            selectedLabels.length > 0 ? color.dim(selectedLabels.join(", ")) : color.dim("none");
          return `${title}${color.gray(S_BAR)}  ${summary}`;
        }
        case "cancel": {
          return `${title}${color.gray(S_BAR)}`;
        }
        case "error": {
          const prefix = `${color.yellow(S_BAR)}  `;
          const renderedOptions = limitOptions({
            output: process.stdout,
            options: this.options,
            cursor: this.cursor,
            maxItems,
            style: (opt: CascadingOption, active: boolean) => styleOption(opt, active),
          });
          return `${title}${prefix}${renderedOptions.join(`\n${prefix}`)}\n${color.yellow(S_BAR_END)}  ${color.yellow(this.error)}\n`;
        }
        default: {
          const prefix = `${color.cyan(S_BAR)}  `;
          const renderedOptions = limitOptions({
            output: process.stdout,
            options: this.options,
            cursor: this.cursor,
            maxItems,
            style: (opt: CascadingOption, active: boolean) => styleOption(opt, active),
          });
          return `${title}${prefix}${renderedOptions.join(`\n${prefix}`)}\n${color.cyan(S_BAR_END)}\n`;
        }
      }
    },
  });

  // Override toggleValue to add cascading logic
  const proto = Object.getPrototypeOf(prompt) as {
    toggleValue: () => void;
  };
  const origToggleValue = proto.toggleValue;

  // @ts-expect-error — overriding private method via instance property shadowing
  prompt.toggleValue = () => {
    const currentOptionValue = prompt.options[prompt.cursor].value;
    const wasSelected = (prompt.value ?? []).includes(currentOptionValue);

    origToggleValue.call(prompt);

    const name = valueToName.get(currentOptionValue);
    if (!name) return;

    if (!wasSelected) {
      // Just selected — add ancestors
      for (const ancestor of getAncestors(name, parentMap)) {
        const val = nameToValue.get(ancestor);
        if (val !== undefined && prompt.value && !prompt.value.includes(val)) {
          prompt.value = [...prompt.value, val];
        }
      }
    } else {
      // Just deselected — remove descendants
      const descendantValues = new Set<string>();
      for (const descendant of getDescendants(name, childrenMap)) {
        const val = nameToValue.get(descendant);
        if (val !== undefined) {
          descendantValues.add(val);
        }
      }
      if (descendantValues.size > 0 && prompt.value) {
        prompt.value = prompt.value.filter((v: string) => !descendantValues.has(v));
      }
    }
  };

  // Override toggleInvert to no-op (inverting breaks cascade invariants)
  // @ts-expect-error — overriding private method via instance property shadowing
  prompt.toggleInvert = () => {};

  return prompt.prompt() as Promise<string[] | symbol>;
}
