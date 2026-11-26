/**
 * 公式文本 → 该怎么渲染：本库画 SVG / 递等式转成 TeX 再交给 MathJax / 原样放行 / 报错。
 * 不碰 DOM，便于测试。
 */
import { buildDengshi, buildDengshiLayout } from "../dengshi/index.ts";
import { ExpressionError } from "../semantic/index.ts";
import { LayoutSyntaxError } from "../parse-layout.ts";
import { OptionError } from "../options.ts";
import type { RenderedSvg } from "../render-svg.ts";
import { renderShushi, renderShushiLayout, shushiLayoutToMathML, shushiToMathML } from "../shushi.ts";
import { renderDuanchu, renderDuanchuLayout } from "../shortdiv/index.ts";
import { renderShuzhuang, renderShuzhuangLayout } from "../factortree/index.ts";
import { renderShizi, renderShiziLayout } from "../crossmul/index.ts";
import { renderZonghe, renderZongheLayout } from "../synthdiv/index.ts";
import { parseFormulaCommand, type FormulaFamily } from "./command.ts";

export type FormulaTranslation =
  | { readonly kind: "pass" }
  | { readonly kind: "svg"; readonly rendered: RenderedSvg }
  | { readonly kind: "tex"; readonly tex: string }
  | { readonly kind: "error"; readonly message: string };

export type FormulaMathMLTranslation =
  | { readonly kind: "pass" }
  | { readonly kind: "mathml"; readonly mathml: string }
  | { readonly kind: "tex"; readonly tex: string }
  | { readonly kind: "error"; readonly message: string };

type SvgFamily = Exclude<FormulaFamily, "dengshi">;
type Renderer = (body: string, options: string | undefined) => RenderedSvg;

/** [语义式, 直写] */
const SVG_RENDERERS: Readonly<Record<SvgFamily, readonly [Renderer, Renderer]>> = {
  shushi: [(b, o) => renderShushi(b, o), (b, o) => renderShushiLayout(b, o)],
  duanchu: [(b, o) => renderDuanchu(b, o), (b, o) => renderDuanchuLayout(b, o)],
  shuzhuang: [(b, o) => renderShuzhuang(b, o), (b, o) => renderShuzhuangLayout(b, o)],
  shizi: [(b, o) => renderShizi(b, o), (b, o) => renderShiziLayout(b, o)],
  zonghe: [(b, o) => renderZonghe(b, o), (b, o) => renderZongheLayout(b, o)],
};

function isUserError(e: unknown): e is Error {
  return e instanceof ExpressionError || e instanceof LayoutSyntaxError || e instanceof OptionError;
}

/** 跑 fn，把写法错误变成带命令名的报错；其他异常（本库的 bug）照常抛出。 */
function guarded<T>(label: string, fn: () => T): T | { readonly kind: "error"; readonly message: string } {
  try {
    return fn();
  } catch (e) {
    if (isUserError(e)) return { kind: "error", message: `${label}：${e.message}` };
    throw e;
  }
}

export function translateFormula(tex: string): FormulaTranslation {
  const cmd = parseFormulaCommand(tex);
  if (cmd.kind !== "command") return cmd;
  const label = `\\${cmd.family}${cmd.starred ? "*" : ""}`;
  if (cmd.family === "dengshi") {
    const build = cmd.starred ? buildDengshiLayout : buildDengshi;
    return guarded(label, () => ({ kind: "tex", tex: build(cmd.body, cmd.options) }) as const);
  }
  const render = SVG_RENDERERS[cmd.family][cmd.starred ? 1 : 0];
  return guarded(label, () => ({ kind: "svg", rendered: render(cmd.body, cmd.options) }) as const);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * 复制为 MathML 时用：竖式给真正的 mstack / mlongdiv；
 * 短除法、树状图、十字相乘、综合除法 MathML 表达不了，只给朗读文字。
 */
export function translateFormulaMathML(tex: string): FormulaMathMLTranslation {
  const cmd = parseFormulaCommand(tex);
  if (cmd.kind !== "command") return cmd;
  if (cmd.family === "shushi") {
    const label = `\\shushi${cmd.starred ? "*" : ""}`;
    const toMathML = cmd.starred ? shushiLayoutToMathML : shushiToMathML;
    return guarded(label, () => ({ kind: "mathml", mathml: toMathML(cmd.body, cmd.options) }) as const);
  }
  const result = translateFormula(tex);
  if (result.kind !== "svg") return result;
  const text = escapeXml(result.rendered.label);
  return {
    kind: "mathml",
    mathml: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" alttext="${text}"><mtext>${text}</mtext></math>`,
  };
}
