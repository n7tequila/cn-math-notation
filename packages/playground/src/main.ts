import katex from "katex";
import "katex/dist/katex.min.css";
import { register, type KatexLike } from "@cn-math-notation/katex";
import type { CarryAt, MulMode, OperatorPlacement, ProcessMode } from "@cn-math-notation/core";
import { EXAMPLES, SEMANTIC_EXAMPLES, semanticTex, toTex } from "./examples.ts";

const STORAGE_KEY = "cmn-playground-v1";
const ALL_EXAMPLES = "__all__";
const ALL_SEMANTIC = "__all_semantic__";

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
const mode = byId<HTMLSelectElement>("mode");
const processMode = byId<HTMLSelectElement>("process");

const instance = katex as unknown as KatexLike;

function applyDefaults(): void {
  register(instance, {
    defaults: {
      carryAt: carryAt.value as CarryAt,
      operatorPlacement: operatorPlacement.value as OperatorPlacement,
      guides: guides.checked,
      padZero: padZero.checked,
      strikeZero: strikeZero.checked,
      multiCarry: multiCarry.checked,
      colorByDigit: colorByDigit.checked,
      mode: mode.value as MulMode,
      process: processMode.value as ProcessMode,
    },
  });
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
  exampleSelect.append(semantic, layout);
}

function exampleText(value: string): string {
  if (value === ALL_EXAMPLES) return EXAMPLES.map(toTex).join("\n\n");
  if (value === ALL_SEMANTIC) return SEMANTIC_EXAMPLES.map(semanticTex).join("\n\n");
  const index = Number(value.slice(1));
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

for (const control of [carryAt, operatorPlacement, guides, padZero, strikeZero, multiCarry, colorByDigit, mode, processMode]) {
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
