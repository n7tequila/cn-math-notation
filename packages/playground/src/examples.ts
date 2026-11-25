/** 试写稿里的例子（docs/design/2026-11-25-直写布局语法试写.md），试写页、demo 脚本与文档图片共用。 */
export interface Example {
  /** 文件名用（docs/images/<id>.svg）。 */
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly options?: string;
}

export const EXAMPLES: readonly Example[] = [
  { id: "add-carry", name: "加法连续进位 74+88", body: String.raw`7 4 \\ + 8 8 \\ \jin{1 1 ~} \\ \hline 1 6 2` },
  { id: "sub-borrow", name: "减法退位 165−84", body: String.raw`\tui{1} 6 5 \\ - 8 4 \\ \hline 8 1` },
  { id: "sub-borrow-zero", name: "跨 0 退位 403−167", body: String.raw`\tui{40} 3 \\ - 1 6 7 \\ \hline 2 3 6` },
  {
    id: "mul-2digit",
    name: "两位数乘两位数 43×37",
    body: String.raw`4 3 \\ \times 3 7 \\ \hline 3 0 1 \\ 1 2 9 ~ \\ \hline 1 5 9 1`,
    options: "operatorPlacement=adjacent",
  },
  {
    id: "mul-carry",
    name: "乘法写进位 538×26",
    body: String.raw`5 3 8 \\ \times 2 6 \\ \textcolor{red}{\jin{2 4 ~}} \\ \hline \textcolor{red}{3 2 2 8} \\ \textcolor{blue}{\jin{1 ~ ~}} \\ \textcolor{blue}{1 0 7 6 ~} \\ \hline 1 3 9 8 8`,
    options: "carryAt=sw",
  },
  { id: "mul-1digit", name: "一位数乘简写 23×4", body: String.raw`2 3 \\ \times 4 \\ \jin{1 ~} \\ \hline 9 2` },
  {
    id: "mul-1digit-expanded",
    name: "一位数乘分步式 23×4",
    body: String.raw`2 3 \\ \times 4 \\ \hline \hong{1} 2 \\ 8 0 \\ \hline 9 2`,
  },
  {
    id: "div-remainder",
    name: "除法有余数 71÷4",
    body: String.raw`\shang 1 7 \\ \chu{4} 7 1 \\ 4 ~ \\ \hline 3 1 \\ 2 8 \\ \hline 3`,
  },
  {
    id: "decimal-add",
    name: "小数加法 24.5+16.3",
    body: String.raw`24.5 \\ + 16.3 \\ \hline 40.8`,
    options: "operatorPlacement=adjacent",
  },
  {
    id: "decimal-pad-zero",
    name: "小数补 0 30.50−25.21",
    body: String.raw`30.5\bu{0} \\ - 25.21 \\ \hline 5.29`,
    options: "operatorPlacement=adjacent",
  },
  {
    id: "child-error",
    name: "孩子的错误过程 403−167=346",
    body: String.raw`\tui{4} 0 3 \\ - 1 6 7 \\ \hline \err{34} 6`,
  },
];

/** 例子 → 可直接放进 $$…$$ 的 TeX，每行一个 \\ 便于阅读。 */
export function toTex(example: Example): string {
  const opts = example.options === undefined ? "" : `[${example.options}]`;
  const rows = example.body.split(String.raw` \\ `).join(" \\\\\n  ");
  return `\\shushi*${opts}{\n  ${rows}\n}`;
}

/** 语义式例子：只写算式，竖式过程由程序算出。 */
export interface SemanticExample {
  readonly id: string;
  readonly name: string;
  readonly expr: string;
  readonly options?: string;
}

export const SEMANTIC_EXAMPLES: readonly SemanticExample[] = [
  { id: "sem-add", name: "加法 365+278", expr: "365+278" },
  { id: "sem-sub-zero", name: "跨 0 退位 403−167", expr: "403-167" },
  { id: "sem-decimal-sub", name: "小数补 0 30.5−25.21", expr: "30.5-25.21" },
  { id: "sem-mul-1digit", name: "一位数乘 329×4", expr: String.raw`329\times4` },
  { id: "sem-mul-zero", name: "因数末尾有 0 380×3", expr: String.raw`380\times3` },
  { id: "sem-decimal-strike", name: "小数末尾 0 划掉 3.45+1.55", expr: "3.45+1.55" },
  { id: "sem-mul-expanded", name: "一位数乘分步式 23×4", expr: String.raw`23\times4`, options: "mode=expanded" },
  { id: "sem-mul-2digit", name: "两位数乘 538×26", expr: String.raw`538\times26` },
  {
    id: "sem-mul-carry-color",
    name: "写进位并按位着色 538×26",
    expr: String.raw`538\times26`,
    options: "multiCarry, colorByDigit, carryAt=sw",
  },
  { id: "sem-div", name: "除法 812÷4（商中间有 0）", expr: String.raw`812\div4` },
  { id: "sem-div-remainder", name: "除法 725÷4", expr: String.raw`725\div4` },
  { id: "sem-child-answer", name: "孩子的答案 403−167=346", expr: "403-167=346" },
];

export function semanticTex(example: SemanticExample): string {
  const opts = example.options === undefined ? "" : `[${example.options}]`;
  return `\\shushi${opts}{${example.expr}}`;
}

/** 递等式例子：整段 TeX。语义式只写算式；直写用 \\ 分行。 */
export interface DengshiExample {
  readonly id: string;
  readonly name: string;
  readonly tex: string;
}

export const DENGSHI_EXAMPLES: readonly DengshiExample[] = [
  { id: "ds-paren", name: "有括号 25×(40+4)", tex: String.raw`\dengshi{25\times(40+4)}` },
  { id: "ds-mixed", name: "先乘除后加减 25×4+36÷6", tex: String.raw`\dengshi{25\times4+36\div6}` },
  { id: "ds-order", name: "乘法优先 20−5+3×4", tex: String.raw`\dengshi{20-5+3\times4}` },
  { id: "ds-bracket", name: "中括号 [100−(20+30)]÷5", tex: String.raw`\dengshi{[100-(20+30)]\div5}` },
  { id: "ds-layout", name: "直写（简便计算）25×(40+4)", tex: String.raw`\dengshi*{25\times(40+4) \\ 25\times40+25\times4 \\ 1000+100 \\ 1100}` },
];
