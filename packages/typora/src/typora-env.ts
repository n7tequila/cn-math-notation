/**
 * Typora 与 typora-community-plugin 运行时提供的全局对象（未公开接口，Typora 1.14.16 + 插件核心 2.10.21 上核实）。
 * 找不到时给出控制台警告，而不是悄悄失效。
 */
import type { MathJaxLike } from "./mathjax-patch.ts";

/** community-plugin 的 Plugin 基类里本插件用到的部分。 */
export interface PluginBase {
  register(dispose: () => void): void;
  registerInterval(intervalId: number): void;
  onload(): void;
  onunload(): void;
}

type PluginConstructor = new (...args: never[]) => PluginBase;

interface PluginRuntime {
  readonly Plugin: PluginConstructor;
}

interface TyporaEditor {
  readonly mathBlock?: { forceRefresh?: () => unknown };
  readonly mathInline?: { renderAll?: () => unknown };
}

interface TyporaWindow {
  readonly MathJax?: MathJaxLike;
  readonly File?: { readonly editor?: TyporaEditor };
  readonly svgCache?: Record<string, string>;
}

const RUNTIME_KEY = Symbol.for("typora-plugin-core@v2");

export const LOG_PREFIX = "[cn-math-notation]";

export function pluginBase(): PluginConstructor {
  const runtime = (window as unknown as Record<symbol, PluginRuntime | undefined>)[RUNTIME_KEY];
  if (runtime === undefined) throw new Error(`${LOG_PREFIX} 没有找到 typora-community-plugin 运行时`);
  return runtime.Plugin;
}

function typoraWindow(): TyporaWindow {
  return window as unknown as TyporaWindow;
}

export function currentMathJax(): MathJaxLike | undefined {
  return typoraWindow().MathJax;
}

/**
 * 让 Typora 重画已经渲染过的公式（插件晚于 MathJax 加载时，本库命令已被画成错误）。
 * isOurs 判断哪些缓存条目是本库命令，先从 Typora 的 SVG 缓存里删掉。返回是否成功调到了刷新入口。
 */
export function refreshAllMath(isOurs: (tex: string) => boolean): boolean {
  const w = typoraWindow();
  const cache = w.svgCache;
  if (cache !== undefined) {
    for (const key of Object.keys(cache)) if (isOurs(key)) delete cache[key];
  }
  const editor = w.File?.editor;
  const forceRefresh = editor?.mathBlock?.forceRefresh;
  const renderAll = editor?.mathInline?.renderAll;
  if (editor === undefined || forceRefresh === undefined || renderAll === undefined) return false;
  forceRefresh.call(editor.mathBlock);
  renderAll.call(editor.mathInline);
  return true;
}
