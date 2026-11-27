/**
 * 识别 Typora 交给 MathJax 的整个公式是不是一条本库命令：`\名字[*][选项]{内容}`。
 *
 * 整个公式就是一条本库命令时由本库直接画（`$$\shushi{74+88}$$`）；和其他公式混写时返回 mixed，
 * 交给接了本库扩展的 MathJax（mathjax-embed.ts，2026-11-27）；接不上扩展时调用方用 MIXED_MESSAGE 报错。
 */

/** 命令族（拼音主名）。 */
export type FormulaFamily = "shushi" | "dengshi" | "duanchu" | "shuzhuang" | "shizi" | "zonghe";

const NAME_TO_FAMILY: Readonly<Record<string, FormulaFamily>> = {
  shushi: "shushi",
  vertical: "shushi",
  dengshi: "dengshi",
  stepeq: "dengshi",
  duanchu: "duanchu",
  shortdiv: "duanchu",
  shuzhuang: "shuzhuang",
  factortree: "shuzhuang",
  shizi: "shizi",
  crossmul: "shizi",
  zonghe: "zonghe",
  synthdiv: "zonghe",
};

/** 全部命令名（拼音主名与英文别名，不带反斜杠）。 */
export const FORMULA_COMMAND_NAMES: readonly string[] = Object.keys(NAME_TO_FAMILY);

const NAMES = FORMULA_COMMAND_NAMES.join("|");
/** 公式里任意位置出现本库命令（命令名后面不能再跟字母）。 */
const ANY_COMMAND = new RegExp(String.raw`\\(?:${NAMES})(?![a-zA-Z])`);
/** 公式开头是本库命令。 */
const LEADING_COMMAND = new RegExp(String.raw`^\\(${NAMES})(?![a-zA-Z])(\*?)`);

export type ParsedFormula =
  | { readonly kind: "pass" }
  /** 本库命令和其他公式写在一起。 */
  | { readonly kind: "mixed" }
  | {
      readonly kind: "command";
      readonly family: FormulaFamily;
      /** 用户实际写的命令名（拼音或英文别名，不带反斜杠和星号），报错时用。 */
      readonly name: string;
      readonly starred: boolean;
      readonly options: string | undefined;
      readonly body: string;
    }
  | { readonly kind: "error"; readonly message: string };

/** 公式里有没有本库命令（不管写得对不对）。 */
export function mentionsFormulaCommand(tex: string): boolean {
  return ANY_COMMAND.test(tex);
}

/** 接不上 MathJax 扩展、不能混写时的报错。 */
export const MIXED_MESSAGE = "本库命令要单独写成一个公式，不能和其他公式写在一起";

export function parseFormulaCommand(tex: string): ParsedFormula {
  const source = tex.trim();
  if (!ANY_COMMAND.test(source)) return { kind: "pass" };

  const head = LEADING_COMMAND.exec(source);
  if (head === null) return { kind: "mixed" };
  const family = NAME_TO_FAMILY[head[1]!]!;
  const starred = head[2] === "*";
  const label = `\\${head[1]}${starred ? "*" : ""}`;

  let pos = skipSpaces(source, head[0].length);
  let options: string | undefined;
  if (source[pos] === "[") {
    const close = source.indexOf("]", pos + 1);
    if (close < 0) return { kind: "error", message: `${label}：选项的方括号没有配对` };
    options = source.slice(pos + 1, close);
    pos = skipSpaces(source, close + 1);
  }

  if (source[pos] !== "{") return { kind: "error", message: `${label}：后面要用花括号写内容，如 ${label}{…}` };
  const close = matchingBrace(source, pos);
  if (close < 0) return { kind: "error", message: `${label}：花括号没有配对` };
  if (skipSpaces(source, close + 1) !== source.length) return { kind: "mixed" };

  return { kind: "command", family, name: head[1]!, starred, options, body: source.slice(pos + 1, close) };
}

function skipSpaces(s: string, from: number): number {
  let i = from;
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return i;
}

/** open 处是 `{`，返回与之配对的 `}` 的下标；`\{`、`\}` 是转义字符，不参与配对。没配上返回 -1。 */
function matchingBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      i++;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
