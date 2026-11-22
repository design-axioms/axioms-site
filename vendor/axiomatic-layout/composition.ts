export type Primitive = "Stack" | "Shelf" | "Switcher";
export type LeafKind = "Text" | "Heading" | "Meta";
export type Composition =
  | { readonly kind: Primitive; readonly children: readonly Composition[] }
  | { readonly kind: LeafKind; readonly text: string };
export type Group = Extract<Composition, { readonly kind: Primitive }>;
export const exampleNames = [
  "flat",
  "nested",
  "grouped",
  "shelf",
  "switcher",
  "nested-switcher",
  "article",
  "event",
  "investigation",
] as const;
export type ExampleName = (typeof exampleNames)[number];
export const Stack = (...children: Composition[]): Composition => ({
  kind: "Stack",
  children,
});
export const Shelf = (...children: Composition[]): Composition => ({
  kind: "Shelf",
  children,
});
export const Switcher = (...children: Composition[]): Composition => ({
  kind: "Switcher",
  children,
});
const Text = (text: string): Composition => ({ kind: "Text", text });
const Heading = (text: string): Composition => ({ kind: "Heading", text });
const Meta = (text: string): Composition => ({ kind: "Meta", text });
export function example(
  name: ExampleName,
  label = "Run lasted 4m 1s",
): Composition {
  const a = Text("Execution completed"),
    b = Text(label),
    c = Text("Remediation Plan proposed"),
    d = Text("Awaiting approval");
  switch (name) {
    case "flat":
      return Stack(a, b, c, d);
    case "nested":
      return Stack(Stack(a, b), Stack(c, d));
    // The Switcher example's facts with every group a Stack: the starting
    // point for choosing arrangements.
    case "grouped":
      return Stack(Stack(a, b, Text("3 checks passed")), Stack(c, d));
    case "shelf":
      return Stack(Shelf(a, b), Stack(c, d));
    case "switcher":
      return Stack(Switcher(a, b, Text("3 checks passed")), Stack(c, d));
    case "nested-switcher":
      return Switcher(Switcher(a, b, Text("Three checks passed")), d);
    case "investigation":
      return Stack(
        Heading("Request-log queries exceed 30-second runtime budget"),
        Text("Investigation completed"),
        Text("Investigation updated: Nov 18, 10:34 AM"),
        Text("Remediation Plan: Bound the request-log query"),
        Text("Remediation Plan awaiting approval"),
        Text("Destination: investigation session"),
      );
    case "event":
      return Stack(
        Text("Neighborhood repair café"),
        Text("Saturday, 10 am–1 pm"),
        Text("Maple Street Library"),
        Text("Free; book a table by Friday"),
        Text("Tell us about access needs when you book"),
      );
    case "article":
      return Stack(
        Stack(
          Heading("Reading the sky"),
          Text("A field guide to noticing the weather"),
          Shelf(Meta("Mara Ellis"), Meta("19 November")),
        ),
        Stack(
          Text(
            "A forecast tells you what may happen. Looking outside tells you what is happening here.",
          ),
          Stack(
            Text("Before you leave, look for:"),
            Stack(
              Text("Clouds building above the hills"),
              Text("A change in the direction of the wind"),
            ),
          ),
        ),
      );
  }
}
export interface SourceToken {
  readonly text: string;
  readonly tone?: "primitive" | "string";
  readonly path?: string;
  readonly kind?: Composition["kind"];
}
export interface SourceLine {
  readonly depth: number;
  readonly tokens: readonly SourceToken[];
  readonly path?: string;
}
function leafTokens(value: Composition, path: string): SourceToken[] {
  if ("children" in value) throw new Error("Expected a leaf");
  return [
    { text: value.kind, path, kind: value.kind },
    { text: "(", path },
    { text: JSON.stringify(value.text), tone: "string", path },
    { text: ")", path },
  ];
}
export function declaration(
  value: Composition,
  path = "0",
  depth = 0,
  printWidth = 80,
): SourceLine[] {
  const pad = { text: "  ".repeat(depth) };
  if (!("children" in value)) {
    const tokens = leafTokens(value, path);
    if (
      depth * 2 + tokens.reduce((size, token) => size + token.text.length, 0) <=
      printWidth
    )
      return [{ tokens: [pad, ...tokens], path, depth }];
    return [
      { tokens: [pad, ...tokens.slice(0, 2)], path, depth },
      {
        tokens: [{ text: "  ".repeat(depth + 1) }, tokens[2]!],
        path,
        depth: depth + 1,
      },
      { tokens: [pad, tokens[3]!], path, depth },
    ];
  }
  const head: SourceToken[] = [
    pad,
    { text: value.kind, tone: "primitive", path, kind: value.kind },
    { text: "(" },
  ];
  if (value.children.every((child) => !("children" in child))) {
    value.children.forEach((child, index) => {
      if (index) head.push({ text: ", " });
      head.push(...leafTokens(child, `${path}.${index}`));
    });
    head.push({ text: ")" });
    if (head.reduce((size, token) => size + token.text.length, 0) <= printWidth)
      return [{ tokens: head, path, depth }];
    // The flat form did not fit. Keep the same tokens/paths in a broken group.
    head.splice(3);
  }
  const lines: SourceLine[] = [{ tokens: head, path, depth }];
  value.children.forEach((child, index) => {
    const childLines = declaration(
      child,
      `${path}.${index}`,
      depth + 1,
      printWidth - (index < value.children.length - 1 ? 1 : 0),
    );
    if (index < value.children.length - 1) {
      const last = childLines.at(-1)!;
      childLines[childLines.length - 1] = {
        ...last,
        tokens: [...last.tokens, { text: "," }],
      };
    }
    lines.push(...childLines);
  });
  lines.push({ tokens: [pad, { text: ")" }], path, depth });
  return lines;
}
