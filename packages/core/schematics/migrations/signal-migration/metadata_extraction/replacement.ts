import MagicString from 'magic-string';

export class Replacement {
  constructor(
      public pos: number,
      public end: number,
      public toInsert: string,
  ) {}
}

export function applyReplacements(input: string, replacements: Replacement[]): string {
  const res = new MagicString(input);
  for (const replacement of replacements) {
    res.remove(replacement.pos, replacement.end);
    res.appendLeft(replacement.pos, replacement.toInsert);
  }
  return res.toString();
}
