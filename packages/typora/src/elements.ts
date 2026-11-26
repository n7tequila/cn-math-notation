/**
 * 把本库的 SVG 包成 Typora 认得的 `<mjx-container jax="SVG">`：
 * Typora 的样式（居中、边距、导出时的缓存）都挂在这个元素上。
 */
import type { RenderedSvg } from "@cn-math-notation/core";
import type { ElementFactory } from "./mathjax-patch.ts";

const ERROR_COLOR = "#cc0000";

function container(doc: Document, display: boolean): HTMLElement {
  const el = doc.createElement("mjx-container");
  el.className = "MathJax cmn-typora";
  el.setAttribute("jax", "SVG");
  if (display) el.setAttribute("display", "true");
  return el;
}

export function createElementFactory(doc: Document): ElementFactory {
  return {
    svg(rendered: RenderedSvg, display: boolean): Element {
      const el = container(doc, display);
      if (!display) el.style.verticalAlign = "middle";
      el.innerHTML = rendered.svg; // svg 由本库生成，内容只含数字、受校验的颜色与固定文字
      return el;
    },
    error(message: string, display: boolean): Element {
      const el = container(doc, display);
      const span = doc.createElement("span");
      span.setAttribute("data-mml-node", "merror"); // Typora 用这个属性判断公式是否出错
      span.style.color = ERROR_COLOR;
      span.textContent = message;
      el.appendChild(span);
      return el;
    },
  };
}
