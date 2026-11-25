/**
 * KaTeX 插件：注册 \shushi*（直写布局）及英文别名 \vertical*。
 *
 * 依赖 KaTeX 的不稳定接口 __defineFunction / __defineMacro（双下划线前缀），
 * 已在 KaTeX 0.19.1 上验证；peerDependencies 锁在 ~0.19.1。
 * 语义式 \shushi{403-167} 由程序算出竖式过程。
 */
import {
  DEFAULT_STYLE,
  ExpressionError,
  LayoutSyntaxError,
  OptionError,
  renderShushi,
  renderShushiLayout,
  type RenderedSvg,
  type StyleOptions,
} from "@cn-math-notation/core";

/** 本插件用到的 KaTeX 最小接口（KaTeX 自带类型未声明 __ 前缀接口）。 */
export interface KatexLike {
  readonly version: string;
  readonly ParseError: new (message: string) => Error;
  __defineFunction(spec: unknown): void;
  __defineMacro(name: string, body: string): void;
}

interface RawArg {
  readonly type: "raw";
  readonly string: string;
}

interface ShushiNode {
  readonly type: "cmn-shushi";
  readonly mode: string;
  readonly rendered: RenderedSvg;
}

const LAYOUT_FN = "\\cmn@shushilayout";
const SEMANTIC_FN = "\\cmn@shushisemantic";
const COMMAND_NAMES = ["\\shushi", "\\vertical"] as const;

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
function mathmlNode(rendered: RenderedSvg) {
  const label = rendered.label;
  return {
    type: "mtext",
    children: [],
    attributes: {},
    classes: [],
    toText: () => label,
    toMarkup: () => `<mtext>${escapeXml(label)}</mtext>`,
    toNode: (): Node => {
      const node = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mtext");
      node.textContent = label;
      return node;
    },
  };
}

/** 每个 KaTeX 实例的默认样式（未在 [ ] 里写的选项取这里）。 */
const defaultsByInstance = new WeakMap<object, StyleOptions>();

export interface RegisterOptions {
  /** 覆盖沪教版默认样式，例如 { carryAt: "sw" }。 */
  readonly defaults?: Partial<StyleOptions>;
}

/**
 * 在给定的 KaTeX 实例上注册命令。重复调用不会重复注册，只更新默认样式。
 */
export function register(katex: KatexLike, options: RegisterOptions = {}): void {
  const alreadyRegistered = defaultsByInstance.has(katex);
  defaultsByInstance.set(katex, { ...DEFAULT_STYLE, ...options.defaults });
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
        const rendered = renderShushiLayout(
          normalizeRaw(args[0]!.string),
          optArgs[0]?.string,
          defaultsByInstance.get(katex) ?? DEFAULT_STYLE,
          { display: "block" },
        );
        return { type: "cmn-shushi", mode: context.parser.mode, rendered };
      } catch (e) {
        if (e instanceof LayoutSyntaxError || e instanceof OptionError) {
          throw new katex.ParseError(`\\shushi*：${e.message}`);
        }
        throw e;
      }
    },
    htmlBuilder: (group: ShushiNode) => htmlNode(group.rendered),
    mathmlBuilder: (group: ShushiNode) => mathmlNode(group.rendered),
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
        const rendered = renderShushi(args[0]!.string, optArgs[0]?.string, defaultsByInstance.get(katex) ?? DEFAULT_STYLE, {
          display: "block",
        });
        return { type: "cmn-shushi", mode: context.parser.mode, rendered };
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
}
