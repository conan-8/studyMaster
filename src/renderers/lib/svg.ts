/**
 * SvgBuilder: deterministic string-based SVG document builder.
 *
 * Rules that keep output byte-stable for identical inputs:
 * - every numeric value passes through fmt() (2-decimal rounding),
 * - attribute order is the insertion order of the plain attrs object,
 * - text content is XML-escaped (& < > "),
 * - serialization is 2-space pretty-printed and ends with a newline.
 */

export type Attrs = Record<string, string | number>;
export type SvgChild = SvgNode | string;

/** Round to 2 decimals, strip trailing zeros, normalize -0 to 0. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`fmt(): non-finite number ${String(n)}`);
  const r = Math.round(n * 100) / 100;
  let s = r.toFixed(2);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

/** Escape XML special characters in text content. */
export function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/** A single detached SVG element; may be attached later via el()/group(). */
export class SvgNode {
  readonly name: string;
  readonly attrs: ReadonlyArray<readonly [string, string]>;
  readonly children: SvgChild[];

  constructor(name: string, attrs: Attrs = {}, children: SvgChild[] = []) {
    this.name = name;
    this.attrs = Object.entries(attrs).map(
      ([k, v]) => [k, typeof v === 'number' ? fmt(v) : v] as const,
    );
    this.children = children;
  }
}

export interface TextOptions {
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  family?: string;
  weight?: string | number;
  fill?: string;
  italic?: boolean;
  rotate?: { angle: number; cx: number; cy: number };
}

// ---------------------------------------------------------------------------
// Detached node factories (usable as children of el()/group(), with exactly
// the same attribute mapping the corresponding SvgBuilder methods use).
// ---------------------------------------------------------------------------

export function lineNode(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attrs: Attrs = {},
): SvgNode {
  return new SvgNode('line', { x1, y1, x2, y2, ...attrs });
}

export function circleNode(cx: number, cy: number, r: number, attrs: Attrs = {}): SvgNode {
  return new SvgNode('circle', { cx, cy, r, ...attrs });
}

export function textNode(x: number, y: number, str: string, opts: TextOptions = {}): SvgNode {
  return new SvgNode('text', textAttrs(x, y, opts), [escapeText(str)]);
}

export function gNode(attrs: Attrs = {}, children: SvgChild[] = []): SvgNode {
  return new SvgNode('g', attrs, children);
}

function textAttrs(x: number, y: number, opts: TextOptions): Attrs {
  const attrs: Attrs = { x, y };
  if (opts.anchor !== undefined) attrs['text-anchor'] = opts.anchor;
  if (opts.size !== undefined) attrs['font-size'] = opts.size;
  if (opts.family !== undefined) attrs['font-family'] = opts.family;
  if (opts.weight !== undefined) attrs['font-weight'] = opts.weight;
  if (opts.italic === true) attrs['font-style'] = 'italic';
  if (opts.fill !== undefined) attrs.fill = opts.fill;
  if (opts.rotate !== undefined) {
    attrs.transform = `rotate(${fmt(opts.rotate.angle)} ${fmt(opts.rotate.cx)} ${fmt(opts.rotate.cy)})`;
  }
  return attrs;
}

function pointsAttr(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface SvgOptions {
  width: number;
  height: number;
  title: string;
  desc?: string;
}

export class SvgBuilder {
  readonly root: SvgNode;
  private readonly stack: SvgNode[];

  constructor(opts: SvgOptions) {
    this.root = new SvgNode(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${fmt(opts.width)} ${fmt(opts.height)}`,
        width: opts.width,
        height: opts.height,
        role: 'img',
      },
      [
        new SvgNode('title', {}, [escapeText(opts.title)]),
        ...(opts.desc !== undefined ? [new SvgNode('desc', {}, [escapeText(opts.desc)])] : []),
      ],
    );
    this.stack = [this.root];
  }

  private get current(): SvgNode {
    return this.stack[this.stack.length - 1] ?? this.root;
  }

  private add(node: SvgNode): this {
    this.current.children.push(node);
    return this;
  }

  /** Append an arbitrary element. */
  el(name: string, attrs: Attrs = {}, children: SvgChild[] = []): this {
    return this.add(new SvgNode(name, attrs, children));
  }

  /**
   * Append a <g>. With `children` the group is complete; without, the group
   * is opened so subsequent calls nest inside it — close with end().
   */
  group(attrs: Attrs = {}, children?: SvgChild[]): this {
    const g = new SvgNode('g', attrs, children ?? []);
    this.add(g);
    if (children === undefined) this.stack.push(g);
    return this;
  }

  /** Close the most recently opened group(). */
  end(): this {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, attrs: Attrs = {}): this {
    return this.add(lineNode(x1, y1, x2, y2, attrs));
  }

  rect(x: number, y: number, w: number, h: number, attrs: Attrs = {}): this {
    return this.add(new SvgNode('rect', { x, y, width: w, height: h, ...attrs }));
  }

  circle(cx: number, cy: number, r: number, attrs: Attrs = {}): this {
    return this.add(circleNode(cx, cy, r, attrs));
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, attrs: Attrs = {}): this {
    return this.add(new SvgNode('ellipse', { cx, cy, rx, ry, ...attrs }));
  }

  path(d: string, attrs: Attrs = {}): this {
    return this.add(new SvgNode('path', { d, ...attrs }));
  }

  polyline(points: ReadonlyArray<readonly [number, number]>, attrs: Attrs = {}): this {
    return this.add(new SvgNode('polyline', { points: pointsAttr(points), ...attrs }));
  }

  polygon(points: ReadonlyArray<readonly [number, number]>, attrs: Attrs = {}): this {
    return this.add(new SvgNode('polygon', { points: pointsAttr(points), ...attrs }));
  }

  text(x: number, y: number, str: string, opts: TextOptions = {}): this {
    return this.add(textNode(x, y, str, opts));
  }

  /** Full pretty-printed SVG document (2-space indent, trailing newline). */
  toString(): string {
    const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    serialize(this.root, 0, out);
    return out.join('\n') + '\n';
  }
}

function serialize(node: SvgNode, depth: number, out: string[]): void {
  const pad = '  '.repeat(depth);
  const attrs = node.attrs.map(([k, v]) => `${k}="${escapeText(v)}"`).join(' ');
  const open = attrs.length > 0 ? `<${node.name} ${attrs}` : `<${node.name}`;
  if (node.children.length === 0) {
    out.push(`${pad}${open}/>`);
    return;
  }
  if (node.children.every((c) => typeof c === 'string')) {
    out.push(`${pad}${open}>${node.children.join('')}</${node.name}>`);
    return;
  }
  out.push(`${pad}${open}>`);
  for (const c of node.children) {
    if (typeof c === 'string') out.push(`${'  '.repeat(depth + 1)}${c}`);
    else serialize(c, depth + 1, out);
  }
  out.push(`${pad}</${node.name}>`);
}
