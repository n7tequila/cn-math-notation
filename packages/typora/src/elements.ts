/**
 * 把本库的 SVG 包成 Typora 认得的 `<mjx-container jax="SVG">`：
 * Typora 的样式（居中、边距、导出时的缓存）都挂在这个元素上。
 */
import { embeddedMathMLFor, embeddedSvgFor, type RenderedSvg } from "@cn-math-notation/core";
import type { ElementFactory } from "./mathjax-patch.ts";

const ERROR_COLOR = "#cc0000";
/** 本库空白盒子携带原命令的属性（core 的 mathjax-embed.ts）。 */
const DATA_TEX = "data-cmn-tex";
/** 本库用过或可能被伪造的 data 属性：一律去掉。 */
const CMN_ATTRS = ["data-cmn-tex", "data-cmn-svg"] as const;
const CMN_SELECTOR = CMN_ATTRS.map((a) => `[${a}]`).join(",");

/**
 * 混写：直接改 DOM，不把序列化的字符串整体赋回去。系统 WebKit 序列化属性值时不转义 >，
 * 字符串替换会错位，把攻击者写在属性值里的元素放出来（2026-11-27 安全审查 C1）。
 * 这里只读属性值、删属性，插入的只有本库按原命令重新画的内容。
 */
function takeCommand(node: Element): string | null {
  const data = node.getAttribute(DATA_TEX);
  for (const attr of CMN_ATTRS) node.removeAttribute(attr);
  return data;
}

function fillSvgBox(g: Element): void {
  const data = takeCommand(g);
  const content = data === null ? "" : embeddedSvgFor(data);
  if (content !== "") g.insertAdjacentHTML("afterbegin", content);
}

/** 辅助 MathML（给读屏软件）：盒子换成本库的 MathML，否则读到的只是空白。 */
function fillMathMLBox(row: Element): void {
  const data = takeCommand(row);
  const mathml = data === null ? undefined : embeddedMathMLFor(data);
  if (mathml !== undefined) row.innerHTML = mathml;
}

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
    inline(el: Element): Element {
      // MathJax 4 会自动换行：一个公式可能拆成好几个 <svg>（中间夹着 <mjx-break>），所以处理容器里的所有盒子。
      // 在辅助 MathML（给读屏软件）里的换成本库的 MathML，其余在本库留的空白盒子里插入内联 SVG。
      for (const node of el.querySelectorAll?.(CMN_SELECTOR) ?? []) {
        if (node.closest("mjx-assistive-mml") === null) fillSvgBox(node);
        else fillMathMLBox(node);
      }
      return el;
    },
  };
}
