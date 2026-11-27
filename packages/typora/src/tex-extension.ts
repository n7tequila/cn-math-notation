/**
 * 混写（维护者 2026-11-27）：往 Typora 自带的 MathJax 4 的 TeX 输入里注册本库命令，
 * 让 `74+88=162 \quad \shushi{74+88}` 这样的公式也能画。宏的实现在 core（mathjax-embed.ts）。
 *
 * 用到的都是 MathJax 组件版的内部对象（未公开接口，按 MathJax 4 源码写，须在 Typora 里实测）：
 * MathJax._.input.tex.TokenMap.CommandMap、MathJax._.input.tex.TexError.default、
 * MathJax.startup.document.inputJax 里 TeX 输入的 parseOptions.handlers。
 * 任何一个找不到就返回 false，调用方照旧提示“本库命令要单独写成一个公式”。
 */
import { createMathJaxMacros, type MathJaxTexErrorClass } from "@cn-math-notation/core";

type CommandMapClass = new (name: string, json: Record<string, unknown>) => unknown;

interface TexInputJax {
  readonly name?: string;
  readonly parseOptions?: {
    readonly handlers?: { add(handlers: { macro: string[] }, fallbacks: object, priority?: number): void };
  };
}

export interface MathJaxRuntime {
  readonly _?: {
    readonly input?: {
      readonly tex?: {
        readonly TokenMap?: { readonly CommandMap?: CommandMapClass };
        readonly TexError?: { readonly default?: MathJaxTexErrorClass };
      };
    };
  };
  readonly startup?: { readonly document?: { readonly inputJax?: readonly TexInputJax[] } };
}

const MAP_NAME = "cmn-macros";
const REGISTERED = Symbol.for("cn-math-notation.typora.texExtension");

/** 注册本库命令；已注册过（同一个 MathJax）直接返回 true。 */
export function registerTexExtension(mj: MathJaxRuntime): boolean {
  const marked = mj as Record<symbol, boolean | undefined>;
  if (marked[REGISTERED] === true) return true;
  const CommandMap = mj._?.input?.tex?.TokenMap?.CommandMap;
  const TexError = mj._?.input?.tex?.TexError?.default;
  const tex = mj.startup?.document?.inputJax?.find((jax) => jax.name === "TeX");
  const handlers = tex?.parseOptions?.handlers;
  if (CommandMap === undefined || TexError === undefined || handlers === undefined) return false;
  new CommandMap(MAP_NAME, createMathJaxMacros(TexError));
  handlers.add({ macro: [MAP_NAME] }, {});
  marked[REGISTERED] = true;
  return true;
}
