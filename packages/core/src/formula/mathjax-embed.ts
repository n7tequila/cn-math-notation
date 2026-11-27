/**
 * 混写（维护者 2026-11-27）：本库命令和普通公式写在同一个公式里，如 `74+88=162 \quad \shushi{74+88}`。
 * 给 MathJax 的 TeX 输入注册本库命令（Typora、出图服务用；KaTeX 插件本来就能混写）：
 * - 竖式等：本库画好 SVG，先在公式里放一个同样大小的空白盒子 <mrow class="cmn-embed"><mspace/></mrow>，
 *   上下居中对着公式中线；原命令以 base64 放在盒子的 data-cmn-tex 属性里。不用图片字形 mglyph：Typora 的 MathJax 加载了 ui/safe，
 *   会删掉 data: 开头的图片地址（实测 MathJax 随后在 mglyph 上抛 RangeError）；
 * - 递等式：转成 TeX 放回输入，由 MathJax 接着排；第一行对齐基线【推论】；
 * - 写法错误：抛 MathJax 的 TexError，显示成公式里的红字。
 * MathJax 排完后用 inlineEmbeddedSvg 按 data-cmn-tex 重新画、在盒子里插入内联 SVG（跟随文字颜色，PNG 转换器也能用内置字体）。
 * 不把 SVG 放进属性里带过去：Typora 的 \data{…} 能伪造 data 属性，带过去的 SVG 不可信；重新画最多只能画出合法的本库命令。
 * 复制为 MathML 时用 embedMathML 把盒子换成本库的 MathML。
 * 本模块不依赖 MathJax：MathJax 的类型只描述用到的几个方法，TexError 由调用方传入。
 */
import { FONT_SIZE } from "../render-svg.ts";
import { FORMULA_COMMAND_NAMES } from "./command.ts";
import { translateFormula, translateFormulaMathML } from "./translate.ts";

/** 宏用到的 MathJax TexParser 方法。 */
export interface MathJaxTexParser {
  string: string;
  i: number;
  GetStar(): boolean;
  GetBrackets(name: string): string | undefined;
  GetArgument(name: string): string;
  create(kind: "node", type: string, children?: unknown[], attrs?: Record<string, unknown>): unknown;
  Push(node: unknown): void;
}

/** MathJax 的 TexError（不继承 Error，所以只要求能 new）。 */
export type MathJaxTexErrorClass = new (id: string, message: string) => unknown;
export type MathJaxMacro = (parser: MathJaxTexParser, name: string) => void;

/** MathJax 的数学轴（等号、加号的中线）在基线上方约 0.25em。 */
const MATH_AXIS_EM = 0.25;
/** MathJax 内部长度单位：1em = 1000。 */
const MATHJAX_UNITS_PER_EM = 1000;
const EMBED_CLASS = "cmn-embed";

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(data: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
}

/** 读出命令的星号、选项、内容，拼回整条命令交给 translateFormula。 */
function readCommand(parser: MathJaxTexParser, name: string): string {
  const star = parser.GetStar() ? "*" : "";
  const options = parser.GetBrackets(name);
  const body = parser.GetArgument(name);
  return `${name}${star}${options === undefined ? "" : `[${options}]`}{${body}}`;
}

function macro(TexError: MathJaxTexErrorClass): MathJaxMacro {
  return (parser, name) => {
    const tex = readCommand(parser, name);
    const r = translateCached(tex);
    switch (r.kind) {
      case "svg": {
        const { widthEm, heightEm } = r.rendered;
        const space = parser.create("node", "mspace", [], {
          width: `${widthEm}em`,
          height: `${heightEm / 2 + MATH_AXIS_EM}em`,
          depth: `${Math.max(0, heightEm / 2 - MATH_AXIS_EM)}em`,
        });
        parser.Push(
          parser.create("node", "mrow", [space], { class: EMBED_CLASS, "data-cmn-tex": toBase64(tex) }),
        );
        return;
      }
      case "tex":
        // 递等式第一行对齐基线【推论】：S=\dengshi{…} 读作“S=第一行”，后面各步往下排
        parser.string = `{${r.tex.replace(/^\\begin\{aligned\}/, "\\begin{aligned}[t]")}}${parser.string.slice(parser.i)}`;
        parser.i = 0;
        return;
      case "error":
        throw new TexError("CmnError", r.message);
      default:
        // 读出来的就是一条完整命令，不会是 pass / mixed
        throw new TexError("CmnError", `${name}：无法识别`);
    }
  };
}

/** 本库全部命令名（不带反斜杠）→ MathJax 宏。 */
export function createMathJaxMacros(TexError: MathJaxTexErrorClass): Record<string, MathJaxMacro> {
  const handler = macro(TexError);
  return Object.fromEntries(FORMULA_COMMAND_NAMES.map((name) => [name, handler]));
}

/**
 * 标签与属性的匹配都认引号：系统 WebKit 序列化属性值时不转义 >，[^>]* 会在属性值中间断开，
 * 插入的内容随之错位，把属性值里的文字放出来变成元素（2026-11-27 安全审查 C1）。
 */
const TAG_BODY = String.raw`((?:[^>"]|"[^"]*")*)`;
const G_TAG = new RegExp(String.raw`<g\b${TAG_BODY}>`, "g");
const MROW_BOX = new RegExp(
  String.raw`<mrow\b${TAG_BODY}>\s*<mspace\b(?:[^>"]|"[^"]*")*?(?:\/>|>\s*<\/mspace>)\s*<\/mrow>`,
  "g",
);
const ATTR = /([^\s="]+)(?:="([^"]*)")?/g;
const ROOT = /^<svg\b([^>]*)>/;
const CMN_ATTR = /^data-cmn-/;

/** 标签里的属性，按出现顺序；值保持序列化后的原样（不解码实体）。 */
function attrList(body: string): [string, string | undefined][] {
  return [...body.matchAll(ATTR)].map((m) => [m[1]!, m[2]]);
}

function attrsOf(source: string): Map<string, string> {
  return new Map(attrList(source).map(([k, v]) => [k, v ?? ""]));
}

/** 去掉 data-cmn-* 属性后重新拼出标签开头。 */
function rebuild(name: string, body: string): string {
  const kept = attrList(body).filter(([k]) => !CMN_ATTR.test(k));
  return `<${name}${kept.map(([k, v]) => (v === undefined ? ` ${k}` : ` ${k}="${v}"`)).join("")}>`;
}

/** 精确尺寸按 viewBox 算（根元素上的 em 尺寸取过整）：本库 SVG 的 1em = FONT_SIZE 个 viewBox 单位。 */
function sizeEm(attrs: Map<string, string>): readonly [number, number] {
  const [, , w = 0, h = 0] = (attrs.get("viewBox") ?? "").split(/\s+/).map(Number);
  return [w / FONT_SIZE, h / FONT_SIZE];
}

/**
 * 本库 SVG → 放进盒子的内联 SVG：根元素换成 MathJax 单位的尺寸、去掉内联样式，颜色跟随外层文字；
 * MathJax 的坐标 y 轴朝上（外层 scale(1,-1)），所以再翻一次，顶边放在基线上方 h/2+0.25em。
 */
function boxContent(svg: string): string {
  const root = ROOT.exec(svg);
  if (root === null) return "";
  const attrs = attrsOf(root[1]!);
  const [wEm, hEm] = sizeEm(attrs);
  const w = wEm * MATHJAX_UNITS_PER_EM;
  const h = hEm * MATHJAX_UNITS_PER_EM;
  const up = (hEm / 2 + MATH_AXIS_EM) * MATHJAX_UNITS_PER_EM;
  const kept = [...attrs].filter(([k]) => !["width", "height", "style", "xmlns"].includes(k));
  const open =
    `<svg width="${w}" height="${h}" preserveAspectRatio="none" fill="currentColor" stroke="none"` +
    kept.map(([k, v]) => ` ${k}="${v}"`).join("") +
    ">";
  return `<g transform="translate(0 ${up}) matrix(1 0 0 -1 0 0)">${open}${svg.slice(root[0].length)}</g>`;
}

/** 同一条命令只渲染一次：宏里量尺寸、排完后重画都用它（2026-11-27 安全审查 H1）。 */
const CACHE_LIMIT = 64;
const cache = new Map<string, ReturnType<typeof translateFormula>>();

function translateCached(tex: string): ReturnType<typeof translateFormula> {
  const hit = cache.get(tex);
  if (hit !== undefined) return hit;
  const r = translateFormula(tex);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(tex, r);
  return r;
}

function decodeCommand(data: string): string | undefined {
  try {
    return fromBase64(data);
  } catch {
    return undefined;
  }
}

/**
 * data-cmn-tex 的值 → 盒子里该放的内联 SVG（本库按原命令重新画）；不是一条合法的本库命令时返回空串。
 * 不信任任何携带过来的 SVG：Typora 的 \data{…} 能伪造 data 属性。给直接操作 DOM 的调用方（Typora 插件）用。
 */
export function embeddedSvgFor(data: string): string {
  const tex = decodeCommand(data);
  if (tex === undefined) return "";
  const r = translateCached(tex);
  return r.kind === "svg" ? boxContent(r.rendered.svg) : "";
}

/** data-cmn-tex 的值 → 本库的 MathML（不含 <math> 外壳）；不是合法的本库命令时返回 undefined。 */
export function embeddedMathMLFor(data: string): string | undefined {
  const tex = decodeCommand(data);
  if (tex === undefined) return undefined;
  const r = translateFormulaMathML(tex);
  return r.kind === "mathml" ? r.mathml.replace(MATH_WRAPPER, "") : undefined;
}

/**
 * MathJax SVG 输出（字符串）里本库的空白盒子 → 按原命令重新画、插入内联 SVG，去掉 data-cmn-* 属性。
 * 给拿到的是字符串的调用方（出图服务）用；调用前先清理一遍输出，属性值里就不会有未转义的 < >。
 */
export function inlineEmbeddedSvg(svg: string): string {
  return svg.replace(G_TAG, (whole, body: string) => {
    const attrs = attrList(body);
    if (!attrs.some(([k]) => CMN_ATTR.test(k))) return whole;
    const data = attrs.find(([k]) => k === "data-cmn-tex")?.[1];
    return rebuild("g", body) + (data === undefined ? "" : embeddedSvgFor(data));
  });
}

const MATH_WRAPPER = /^<math\b[^>]*>|<\/math>$/g;

/** MathJax 的 MathML 输出里本库的盒子 → 本库的 MathML（竖式为 mstack，其他写法为朗读文字）。 */
export function embedMathML(mml: string): string {
  return mml.replace(MROW_BOX, (whole, body: string) => {
    const data = attrList(body).find(([k]) => k === "data-cmn-tex")?.[1];
    const inner = data === undefined ? undefined : embeddedMathMLFor(data);
    return inner === undefined ? whole : `<mrow>${inner}</mrow>`;
  });
}
