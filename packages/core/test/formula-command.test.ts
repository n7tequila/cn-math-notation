import { describe, expect, test } from "bun:test";
import { parseFormulaCommand } from "../src/index.ts";

describe("parseFormulaCommand：识别整个公式是不是一条本库命令", () => {
  test("普通公式原样放行", () => {
    expect(parseFormulaCommand(String.raw`\frac{1}{2}+x^2`)).toEqual({ kind: "pass" });
    expect(parseFormulaCommand("")).toEqual({ kind: "pass" });
  });

  test("命令名后面紧跟字母的不算本库命令", () => {
    expect(parseFormulaCommand(String.raw`\shushiX{1}`)).toEqual({ kind: "pass" });
  });

  test("语义式：命令、选项、内容", () => {
    expect(parseFormulaCommand(String.raw`\shushi[multiCarry, colorByDigit]{538\times26}`)).toEqual({
      kind: "command",
      family: "shushi",
      name: "shushi",
      starred: false,
      options: "multiCarry, colorByDigit",
      body: String.raw`538\times26`,
    });
  });

  test("直写：星号，内容里有嵌套花括号", () => {
    expect(parseFormulaCommand(String.raw`\shushi*{ 7 4 \\ + 8 8 \\ \jin{1 1 ~} \\ \hline 1 6 2 }`)).toEqual({
      kind: "command",
      family: "shushi",
      name: "shushi",
      starred: true,
      options: undefined,
      body: String.raw` 7 4 \\ + 8 8 \\ \jin{1 1 ~} \\ \hline 1 6 2 `,
    });
  });

  test("前后空白、换行、命令与参数之间的空格都允许", () => {
    const r = parseFormulaCommand("\n  \\duanchu [result] {36, 48}\n");
    expect(r).toEqual({ kind: "command", family: "duanchu", name: "duanchu", starred: false, options: "result", body: "36, 48" });
  });

  test("英文别名归到同一个命令", () => {
    const names: Array<[string, string]> = [
      ["vertical", "shushi"],
      ["stepeq", "dengshi"],
      ["shortdiv", "duanchu"],
      ["factortree", "shuzhuang"],
      ["crossmul", "shizi"],
      ["synthdiv", "zonghe"],
    ];
    for (const [alias, family] of names) {
      const r = parseFormulaCommand(`\\${alias}{1}`);
      expect(r.kind === "command" ? r.family : undefined).toBe(family as never);
    }
  });

  test("转义的花括号不参与配对", () => {
    const r = parseFormulaCommand(String.raw`\dengshi*{a \} b}`);
    expect(r).toEqual({ kind: "command", family: "dengshi", name: "dengshi", starred: true, options: undefined, body: String.raw`a \} b` });
  });

  test("和其他公式混写时返回 mixed（2026-11-27 起交给接了本库扩展的 MathJax）", () => {
    expect(parseFormulaCommand(String.raw`74+88=162 \quad \shushi{74+88}`).kind).toBe("mixed");
    expect(parseFormulaCommand(String.raw`\shushi{74+88} \quad x`).kind).toBe("mixed");
  });

  test("花括号没配对、缺内容时报错", () => {
    const open = parseFormulaCommand(String.raw`\shushi{74+88`);
    expect(open.kind).toBe("error");
    if (open.kind === "error") expect(open.message).toContain("花括号");
    expect(parseFormulaCommand(String.raw`\shushi`).kind).toBe("error");
    expect(parseFormulaCommand(String.raw`\shushi[result`).kind).toBe("error");
  });
});
