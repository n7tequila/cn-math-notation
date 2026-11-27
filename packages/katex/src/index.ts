/**
 * KaTeX 插件：注册 \shushi / \shushi*（竖式，英文别名 \vertical）、\dengshi / \dengshi*（递等式，英文别名 \stepeq）
 * 、\duanchu / \duanchu*（短除法，英文别名 \shortdiv）、\shuzhuang / \shuzhuang*（树状图，英文别名 \factortree）
 * 、\shizi / \shizi*（十字相乘，英文别名 \crossmul）与 \zonghe / \zonghe*（综合除法，英文别名 \synthdiv）。
 *
 * 依赖 KaTeX 的不稳定接口 __defineFunction / __defineMacro（双下划线前缀），
 * 已在 KaTeX 0.19.1 上验证；peerDependencies 锁在 ~0.19.1。
 * 语义式 \shushi{403-167} 由程序算出竖式过程。
 */
import {
  buildDengshi,
  buildDengshiLayout,
  DEFAULT_STYLE,
  ExpressionError,
  LayoutSyntaxError,
  OptionError,
  buildSemantic,
  layoutToMathML,
  parseLayout,
  parseOptions,
  renderLayout,
  renderDuanchu,
  renderDuanchuLayout,
  renderShizi,
  renderZonghe,
  renderZongheLayout,
  renderShiziLayout,
  renderShuzhuang,
  renderShuzhuangLayout,
  type Layout,
  type RenderedSvg,
  type StyleOptions,
} from "@cn-math-notation/core";

/** 本插件用到的 KaTeX 最小接口（KaTeX 自带类型未声明 __ 前缀接口）。 */
export interface KatexLike {
  readonly version: string;
  readonly ParseError: new (message: string) => Error;
  __defineFunction(spec: unknown): void;
  __defineMacro(name: string, body: string): void;
  __parse(expression: string, options?: Record<string, unknown>): unknown[];
}

interface RawArg {
  readonly type: "raw";
  readonly string: string;
}

interface ShushiNode {
  readonly type: "cmn-shushi";
  readonly mode: string;
  readonly rendered: RenderedSvg;
  /** 不含 <math> 外壳的 MathML（mstack / mlongdiv），或 undefined 表示只给朗读文字。 */
  readonly mathml: string | undefined;
}

const LAYOUT_FN = "\\cmn@shushilayout";
const SEMANTIC_FN = "\\cmn@shushisemantic";
const COMMAND_NAMES = ["\\shushi", "\\vertical"] as const;
const DENGSHI_LAYOUT_FN = "\\cmn@dengshilayout";
const DENGSHI_SEMANTIC_FN = "\\cmn@dengshisemantic";
const DENGSHI_NAMES = ["\\dengshi", "\\stepeq"] as const;
const DUANCHU_NAMES = ["\\duanchu", "\\shortdiv"] as const;
const SHUZHUANG_NAMES = ["\\shuzhuang", "\\factortree"] as const;
const SHIZI_NAMES = ["\\shizi", "\\crossmul"] as const;
const ZONGHE_NAMES = ["\\zonghe", "\\synthdiv"] as const;

/**
 * KaTeX 在 raw 参数里仍会展开宏（原型实测 0.19.1）：`~` 会变成 `\nobreakspace`，
 * 换行被吞掉（所以分行必须用 `\\`）。这里把 `\nobreakspace` 还原成 `~` 再交给核心解析。
 */
export function normalizeRaw(raw: string): string {
  return raw.replace(/\\nobreakspace(?![a-zA-Z])/g, "~ ");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 竖式块的 HTML 节点：以数学轴为中心，按 em 撑开高度。 */
function htmlNode(rendered: RenderedSvg) {
  const height = rendered.heightEm / 2 + 0.25;
  const depth = rendered.heightEm - height;
  const style = `display:inline-block;vertical-align:${(-depth).toFixed(3)}em;height:${rendered.heightEm.toFixed(3)}em;line-height:0`;
  const markup = `<span class="cmn-shushi-box" style="${style}">${rendered.svg}</span>`;
  return {
    classes: ["cmn-shushi-box"],
    height,
    depth,
    maxFontSize: 1,
    style: {},
    hasClass: (c: string) => c === "cmn-shushi-box",
    toMarkup: () => markup,
    toNode: (): Node => {
      const span = document.createElement("span");
      span.className = "cmn-shushi-box";
      span.setAttribute("style", style);
      span.innerHTML = rendered.svg; // svg 由本库生成，内容只含数字、受校验的颜色与固定文字
      return span;
    },
  };
}

/** MathML 侧先给朗读文字；导出 mstack 属后续工作（设计草案 §7）。 */
/**
 * MathML 侧：默认给真正的 mstack / mlongdiv（可复制到其他支持 MathML 的工具）；
 * register 时选 mathml: "label" 则只给一段朗读文字。
 */
function mathmlNode(rendered: RenderedSvg, mathml: string | undefined) {
  const label = rendered.label;
  const markup = mathml ?? `<mtext>${escapeXml(label)}</mtext>`;
  return {
    type: mathml === undefined ? "mtext" : "mrow",
    children: [],
    attributes: {},
    classes: [],
    toText: () => label,
    toMarkup: () => markup,
    toNode: (): Node => {
      const doc = new DOMParser().parseFromString(`<math xmlns="${MATHML_NS}">${markup}</math>`, "application/xml");
      return document.importNode(doc.documentElement.firstElementChild!, true);
    },
  };
}

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

interface InstanceConfig {
  readonly style: StyleOptions;
  readonly mathml: "mstack" | "label";
  readonly carries: "textbook" | "above";
}

/** 每个 KaTeX 实例的配置（默认样式：未在 [ ] 里写的选项取这里）。 */
const configByInstance = new WeakMap<object, InstanceConfig>();

export interface RegisterOptions {
  /** 覆盖沪教版默认样式，例如 { carryAt: "sw" }。 */
  readonly defaults?: Partial<StyleOptions>;
  /** KaTeX 输出里隐藏的 MathML：mstack（默认，真正的竖式结构）或 label（只给朗读文字）。 */
  readonly mathml?: "mstack" | "label";
  /** 导出 MathML 时进位的方位，见 @cn-math-notation/core 的 MathMLOptions.carries。 */
  readonly mathmlCarries?: "textbook" | "above";
}

function nodeFor(katex: KatexLike, mode: string, layout: Layout, style: StyleOptions): ShushiNode {
  const config = configByInstance.get(katex)!;
  const rendered = renderLayout(layout, style, { display: "block" });
  const mathml = config.mathml === "label" ? undefined : layoutToMathML(layout, style, { wrap: false, carries: config.carries });
  return { type: "cmn-shushi", mode, rendered, mathml };
}

/**
 * 在给定的 KaTeX 实例上注册命令。重复调用不会重复注册，只更新默认样式。
 */
export function register(katex: KatexLike, options: RegisterOptions = {}): void {
  const alreadyRegistered = configByInstance.has(katex);
  configByInstance.set(katex, {
    style: { ...DEFAULT_STYLE, ...options.defaults },
    mathml: options.mathml ?? "mstack",
    carries: options.mathmlCarries ?? "textbook",
  });
  if (alreadyRegistered) return;

  katex.__defineFunction({
    type: "cmn-shushi",
    names: [LAYOUT_FN],
    // KaTeX 0.19 的函数定义是扁平结构（早期版本放在 props 里）
    numArgs: 1,
    numOptionalArgs: 1,
    argTypes: ["raw", "raw"],
    allowedInText: true,
    handler: (context: { parser: { mode: string } }, args: RawArg[], optArgs: (RawArg | null)[]): ShushiNode => {
      try {
        const style = parseOptions(optArgs[0]?.string, configByInstance.get(katex)!.style);
        return nodeFor(katex, context.parser.mode, parseLayout(normalizeRaw(args[0]!.string)), style);
      } catch (e) {
        if (e instanceof LayoutSyntaxError || e instanceof OptionError) {
          throw new katex.ParseError(`\\shushi*：${e.message}`);
        }
        throw e;
      }
    },
    htmlBuilder: (group: ShushiNode) => htmlNode(group.rendered),
    mathmlBuilder: (group: ShushiNode) => mathmlNode(group.rendered, group.mathml),
  });

  katex.__defineFunction({
    type: "cmn-shushi",
    names: [SEMANTIC_FN],
    numArgs: 1,
    numOptionalArgs: 1,
    argTypes: ["raw", "raw"],
    allowedInText: true,
    handler: (context: { parser: { mode: string } }, args: RawArg[], optArgs: (RawArg | null)[]): ShushiNode => {
      try {
        const style = parseOptions(optArgs[0]?.string, configByInstance.get(katex)!.style);
        return nodeFor(katex, context.parser.mode, buildSemantic(args[0]!.string, style), style);
      } catch (e) {
        if (e instanceof ExpressionError || e instanceof OptionError) {
          throw new katex.ParseError(`\\shushi：${e.message}`);
        }
        throw e;
      }
    },
  });

  for (const name of COMMAND_NAMES) {
    katex.__defineMacro(name, `\\@ifstar${LAYOUT_FN}${SEMANTIC_FN}`);
  }
  registerDengshi(katex);
  registerSvgCommand(katex, "duanchu", DUANCHU_NAMES, renderDuanchu, renderDuanchuLayout);
  registerSvgCommand(katex, "shuzhuang", SHUZHUANG_NAMES, renderShuzhuang, renderShuzhuangLayout);
  registerSvgCommand(katex, "shizi", SHIZI_NAMES, renderShizi, renderShiziLayout);
  registerSvgCommand(katex, "zonghe", ZONGHE_NAMES, renderZonghe, renderZongheLayout);
}

type SvgRenderer = (raw: string, options: string | undefined, render: { display: "block" }) => RenderedSvg;

/**
 * 短除法、树状图、十字相乘、综合除法：本库画成 SVG；MathML 表达不了这几种写法（设计草案 §6），隐藏的 MathML 只给朗读文字。
 * 注册 \<name>[选项]{…}（语义式）与 \<name>*[选项]{…}（直写）以及英文别名。
 */
function registerSvgCommand(
  katex: KatexLike,
  name: string,
  names: readonly string[],
  semantic: SvgRenderer,
  layout: SvgRenderer,
): void {
  const define = (fnName: string, render: (raw: string, options?: string) => RenderedSvg, label: string) =>
    katex.__defineFunction({
      type: "cmn-shushi",
      names: [fnName],
      numArgs: 1,
      numOptionalArgs: 1,
      argTypes: ["raw", "raw"],
      allowedInText: true,
      handler: (context: { parser: { mode: string } }, args: RawArg[], optArgs: (RawArg | null)[]): ShushiNode => {
        try {
          const rendered = render(normalizeRaw(args[0]!.string), optArgs[0]?.string);
          return { type: "cmn-shushi", mode: context.parser.mode, rendered, mathml: undefined };
        } catch (e) {
          if (e instanceof ExpressionError || e instanceof LayoutSyntaxError || e instanceof OptionError) {
            throw new katex.ParseError(`${label}：${e.message}`);
          }
          throw e;
        }
      },
    });
  const layoutFn = `\\cmn@${name}layout`;
  const semanticFn = `\\cmn@${name}semantic`;
  define(layoutFn, (raw, options) => layout(raw, options, { display: "block" }), `\\${name}*`);
  define(semanticFn, (raw, options) => semantic(raw, options, { display: "block" }), `\\${name}`);
  for (const alias of names) {
    katex.__defineMacro(alias, `\\@ifstar${layoutFn}${semanticFn}`);
  }
}

/**
 * 递等式：本库算出每一步、拼成 aligned 环境的 TeX，再交给 KaTeX 自己解析成节点嵌回当前公式，
 * 所以行内的分数、括号等都按 KaTeX 的排版来。
 */
function registerDengshi(katex: KatexLike): void {
  const define = (fnName: string, build: (raw: string, options?: string) => string, label: string) =>
    katex.__defineFunction({
      type: "ordgroup",
      names: [fnName],
      numArgs: 1,
      numOptionalArgs: 1,
      argTypes: ["raw", "raw"],
      allowedInText: true,
      handler: (context: { parser: { mode: string; settings: object } }, args: RawArg[], optArgs: (RawArg | null)[]) => {
        let tex: string;
        try {
          tex = build(normalizeRaw(args[0]!.string), optArgs[0]?.string);
        } catch (e) {
          if (e instanceof ExpressionError || e instanceof OptionError) throw new katex.ParseError(`${label}：${e.message}`);
          throw e;
        }
        // 用当前公式的设置解析（调用方的 macros、trust、strict 等），只把报错改成抛出、由外层统一处理
        const settings = { ...context.parser.settings, throwOnError: true };
        return { type: "ordgroup", mode: context.parser.mode, body: katex.__parse(tex, settings) };
      },
    });
  define(DENGSHI_LAYOUT_FN, buildDengshiLayout, "\\dengshi*");
  define(DENGSHI_SEMANTIC_FN, buildDengshi, "\\dengshi");
  for (const name of DENGSHI_NAMES) {
    katex.__defineMacro(name, `\\@ifstar${DENGSHI_LAYOUT_FN}${DENGSHI_SEMANTIC_FN}`);
  }
}
