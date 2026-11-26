/**
 * Typora 插件入口（typora-community-plugin）：在 Typora 的公式里画本库写法。
 * 写法：本库命令单独写成一个公式，如 `$$\shushi{74+88}$$`。
 *
 * MathJax 是按需加载的，改公式设置时还会重新加载，所以定时检查，发现没包过的就包上并重画已有公式。
 */
import { mentionsCommand } from "./command.ts";
import { createElementFactory } from "./elements.ts";
import { isPatched, patchMathJax } from "./mathjax-patch.ts";
import { currentMathJax, LOG_PREFIX, pluginBase, refreshAllMath } from "./typora-env.ts";

const CHECK_INTERVAL_MS = 1000;
/** 这么久还没找到 MathJax 入口，就提示可能是 Typora 升级后内部接口变了。 */
const MISSING_WARN_AFTER_MS = 30_000;
const MATH_SELECTOR = "#write .md-math-block, #write .md-inline-math";

export default class CnMathNotationPlugin extends pluginBase() {
  private restore: (() => void) | undefined;
  private startedAt = 0;
  private warnedMissing = false;

  override onload(): void {
    this.startedAt = Date.now();
    this.check();
    this.registerInterval(window.setInterval(() => this.check(), CHECK_INTERVAL_MS));
    this.register(() => this.restore?.());
  }

  private check(): void {
    const mj = currentMathJax();
    if (mj !== undefined && isPatched(mj)) return;
    if (mj === undefined || mj.tex2svg === undefined || mj.tex2svgPromise === undefined || mj.tex2mml === undefined) {
      this.warnIfMissingTooLong();
      return;
    }
    this.restore = patchMathJax(mj, createElementFactory(document));
    if (!refreshAllMath(mentionsCommand)) {
      console.warn(`${LOG_PREFIX} 没有找到 Typora 的公式刷新入口（可能是 Typora 升级后内部接口变了）；已打开的公式要编辑一下才会重画。`);
    }
  }

  private warnIfMissingTooLong(): void {
    if (this.warnedMissing || Date.now() - this.startedAt < MISSING_WARN_AFTER_MS) return;
    // 文档里没有公式时 Typora 可能根本不加载 MathJax，这不算异常
    if (document.querySelector(MATH_SELECTOR) === null) return;
    this.warnedMissing = true;
    console.warn(`${LOG_PREFIX} 还没有找到 MathJax 的渲染入口（tex2svg / tex2svgPromise / tex2mml）；如果文档里有公式却画不出竖式，可能是 Typora 升级后内部接口变了。`);
  }
}
