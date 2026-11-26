import katex from "katex";
import "katex/dist/katex.min.css";
import { register, type KatexLike } from "@cn-math-notation/katex";
import {
  DEFAULT_STYLE,
  shushiLayoutToMathML,
  shushiToMathML,
  type CarryAt,
  type MulMode,
  type OperatorPlacement,
  type ProcessMode,
  type StyleOptions,
} from "@cn-math-notation/core";
import { DENGSHI_EXAMPLES, DUANCHU_EXAMPLES, EXAMPLES, SEMANTIC_EXAMPLES, semanticTex, toTex } from "./examples.ts";

const STORAGE_KEY = "cmn-playground-v1";
const ALL_EXAMPLES = "__all__";
const ALL_SEMANTIC = "__all_semantic__";
const ALL_DENGSHI = "__all_dengshi__";
const ALL_DUANCHU = "__all_duanchu";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`页面缺少 #${id}`);
  return el as T;
}

const source = byId<HTMLTextAreaElement>("source");
const preview = byId<HTMLDivElement>("preview");
const exampleSelect = byId<HTMLSelectElement>("example");
const carryAt = byId<HTMLSelectElement>("carryAt");
const operatorPlacement = byId<HTMLSelectElement>("operatorPlacement");
const guides = byId<HTMLInputElement>("guides");
const padZero = byId<HTMLInputElement>("padZero");
const strikeZero = byId<HTMLInputElement>("strikeZero");
const multiCarry = byId<HTMLInputElement>("multiCarry");
const colorByDigit = byId<HTMLInputElement>("colorByDigit");
const carry = byId<HTMLInputElement>("carry");
const markPoint = byId<HTMLInputElement>("markPoint");
const markAppended = byId<HTMLInputElement>("markAppended");
const remainder = byId<HTMLInputElement>("remainder");
const pointColumn = byId<HTMLInputElement>("pointColumn");
const mode = byId<HTMLSelectElement>("mode");
const processMode = byId<HTMLSelectElement>("process");

const instance = katex as unknown as KatexLike;

function currentDefaults(): StyleOptions {
  return {
    ...DEFAULT_STYLE,
    carryAt: carryAt.value as CarryAt,
    operatorPlacement: operatorPlacement.value as OperatorPlacement,
    guides: guides.checked,
    padZero: padZero.checked,
    strikeZero: strikeZero.checked,
    multiCarry: multiCarry.checked,
    colorByDigit: colorByDigit.checked,
    mode: mode.value as MulMode,
    process: processMode.value as ProcessMode,
    carry: carry.checked,
    markPoint: markPoint.checked,
    markAppended: markAppended.checked,
    remainder: remainder.checked,
    pointColumn: pointColumn.checked,
  };
}

/** 整块只有一个竖式命令时，返回它的 MathML（用于“复制 MathML”）；否则 undefined。 */
function blockMathML(block: string): string | undefined {
  const m = /^\\(?:shushi|vertical)(\*)?(?:\[([^\]]*)\])?\{([\s\S]*)\}$/.exec(block.trim());
  if (m === null) return undefined;
  const [, star, opts, body] = m;
  return star === "*"
    ? shushiLayoutToMathML(body!, opts, currentDefaults())
    : shushiToMathML(body!, opts, currentDefaults());
}

function copyButton(mathml: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-mathml";
  button.textContent = "复制 MathML";
  button.addEventListener("click", () => {
    navigator.clipboard.writeText(mathml).then(
      () => {
        button.textContent = "已复制";
        setTimeout(() => (button.textContent = "复制 MathML"), 1500);
      },
      () => {
        button.textContent = "复制失败";
      },
    );
  });
  return button;
}

function applyDefaults(): void {
  register(instance, { defaults: currentDefaults() });
}

/** 空行分隔的每一块单独渲染，一块出错不影响其他块。 */
function render(): void {
  const blocks = source.value
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b !== "");
  preview.replaceChildren(
    ...blocks.map((block) => {
      const figure = document.createElement("figure");
      figure.className = "block";
      try {
        katex.render(block, figure, { displayMode: true, throwOnError: true });
        const mathml = blockMathML(block);
        if (mathml !== undefined) figure.append(copyButton(mathml));
      } catch (e) {
        figure.classList.add("has-error");
        const msg = document.createElement("p");
        msg.className = "error";
        msg.textContent = e instanceof Error ? e.message : String(e);
        figure.replaceChildren(msg);
      }
      return figure;
    }),
  );
  if (blocks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "左边写点什么，或者从上面选一个例子。";
    preview.replaceChildren(empty);
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, source.value);
  } catch {
    // 私密窗口等情况下存不了，不影响使用
  }
}

function load(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let pending = 0;
function scheduleRender(): void {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    render();
    save();
  });
}

function option(value: string, text: string): HTMLOptionElement {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = text;
  return opt;
}

function fillExamples(): void {
  const semantic = document.createElement("optgroup");
  semantic.label = "语义式（只写算式）";
  semantic.append(...SEMANTIC_EXAMPLES.map((ex, i) => option(`s${i}`, ex.name)), option(ALL_SEMANTIC, "全部语义式例子"));
  const layout = document.createElement("optgroup");
  layout.label = "直写布局（逐行写）";
  layout.append(...EXAMPLES.map((ex, i) => option(`l${i}`, ex.name)), option(ALL_EXAMPLES, "全部直写布局例子"));
  const dengshi = document.createElement("optgroup");
  dengshi.label = "递等式";
  dengshi.append(...DENGSHI_EXAMPLES.map((ex, i) => option(`d${i}`, ex.name)), option(ALL_DENGSHI, "全部递等式例子"));
  const duanchu = document.createElement("optgroup");
  duanchu.label = "短除法";
  duanchu.append(...DUANCHU_EXAMPLES.map((ex, i) => option(`c${i}`, ex.name)), option(ALL_DUANCHU, "全部短除法例子"));
  exampleSelect.append(semantic, layout, dengshi, duanchu);
}

function exampleText(value: string): string {
  if (value === ALL_EXAMPLES) return EXAMPLES.map(toTex).join("\n\n");
  if (value === ALL_SEMANTIC) return SEMANTIC_EXAMPLES.map(semanticTex).join("\n\n");
  if (value === ALL_DENGSHI) return DENGSHI_EXAMPLES.map((ex) => ex.tex).join("\n\n");
  if (value === ALL_DUANCHU) return DUANCHU_EXAMPLES.map((ex) => ex.tex).join("\n\n");
  const index = Number(value.slice(1));
  if (value.startsWith("d")) return DENGSHI_EXAMPLES[index]!.tex;
  if (value.startsWith("c")) return DUANCHU_EXAMPLES[index]!.tex;
  return value.startsWith("s") ? semanticTex(SEMANTIC_EXAMPLES[index]!) : toTex(EXAMPLES[index]!);
}

exampleSelect.addEventListener("change", () => {
  const v = exampleSelect.value;
  if (v === "") return;
  source.value = exampleText(v);
  exampleSelect.value = "";
  scheduleRender();
  source.focus();
});

for (const control of [carryAt, operatorPlacement, guides, padZero, strikeZero, multiCarry, colorByDigit, carry, markPoint, markAppended, remainder, pointColumn, mode, processMode]) {
  control.addEventListener("change", () => {
    applyDefaults();
    render();
  });
}
source.addEventListener("input", scheduleRender);

fillExamples();
applyDefaults();
source.value = load() ?? SEMANTIC_EXAMPLES.map(semanticTex).join("\n\n");
render();
