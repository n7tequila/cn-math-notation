/**
 * 代数项的排版工具（十字相乘、多项式竖式共用）：
 * 文字统一用 “−” 作负号、上标数字作次数（x²、x³）；SVG 里字母斜体；MathML 里拆成 mo / mn / mi / msup。
 */

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

export function superscript(n: number): string {
  return [...String(n)].map((d) => SUPERSCRIPT[Number(d)]).join("");
}

/** 直写里的原文 → 排版文字：x^2、x^{2} → x²，- → −，去掉空白。 */
export function prettyTerm(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/\^\{?(\d+)\}?/g, (_, n: string) => superscript(Number(n)))
    .replace(/-/g, "−");
}

/** SVG：字母排成斜体 tspan，其余原样。 */
export function mathTextSvg(text: string): string {
  return [...text.matchAll(/[a-zA-Z]+|[^a-zA-Z]+/g)]
    .map(([run]) => (/^[a-zA-Z]/.test(run) ? `<tspan font-style="italic">${run}</tspan>` : run))
    .join("");
}

const FROM_SUPERSCRIPT: Readonly<Record<string, string>> = Object.fromEntries(
  [...SUPERSCRIPT].map((ch, i) => [ch, String(i)]),
);

/** MathML：+3x → <mrow><mo>+</mo><mn>3</mn><mi>x</mi></mrow>；x² → <msup><mi>x</mi><mn>2</mn></msup>。 */
export function termToMathML(text: string): string {
  const parts: string[] = [];
  for (const [tok] of text.matchAll(/[+−=]|\d+|[a-zA-Z][⁰¹²³⁴⁵⁶⁷⁸⁹]*|[^\s]/g)) {
    if (/^[+−=]$/.test(tok)) parts.push(`<mo>${tok}</mo>`);
    else if (/^\d+$/.test(tok)) parts.push(`<mn>${tok}</mn>`);
    else if (/^[a-zA-Z]/.test(tok)) {
      const sup = [...tok.slice(1)].map((ch) => FROM_SUPERSCRIPT[ch]).join("");
      parts.push(sup === "" ? `<mi>${tok[0]}</mi>` : `<msup><mi>${tok[0]}</mi><mn>${sup}</mn></msup>`);
    } else parts.push(`<mo>${tok}</mo>`);
  }
  return parts.length === 1 ? parts[0]! : `<mrow>${parts.join("")}</mrow>`;
}

/** 是否含字母（含字母的竖式按多项式排）。 */
export function hasLetters(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}
