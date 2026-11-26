import { describe, expect, test } from "bun:test";
import { DEFAULT_PARAMS, LIMITS, parseParams, ParamError } from "../src/params.ts";

describe("parseParams：校验出图参数", () => {
  test("只给 tex 时其余取默认值", () => {
    expect(parseParams({ tex: "x" })).toEqual({ ...DEFAULT_PARAMS, tex: "x" });
  });

  test("数字参数可以是字符串（来自查询串）", () => {
    const p = parseParams({ tex: "x", size: "48", format: "png", color: "#336699", background: "white" });
    expect(p).toEqual({ tex: "x", size: 48, format: "png", color: "#336699", background: "white" });
  });

  test("缺 tex、tex 为空或过长时报错", () => {
    expect(() => parseParams({})).toThrow(ParamError);
    expect(() => parseParams({ tex: "   " })).toThrow(ParamError);
    expect(() => parseParams({ tex: "1".repeat(LIMITS.maxTexLength + 1) })).toThrow(ParamError);
  });

  test("size 超出范围或不是整数时报错", () => {
    expect(() => parseParams({ tex: "x", size: LIMITS.maxSize + 1 })).toThrow(ParamError);
    expect(() => parseParams({ tex: "x", size: LIMITS.minSize - 1 })).toThrow(ParamError);
    expect(() => parseParams({ tex: "x", size: "abc" })).toThrow(ParamError);
    expect(() => parseParams({ tex: "x", size: 12.5 })).toThrow(ParamError);
  });

  test("颜色只接受十六进制色值或英文颜色名，防止注入 SVG", () => {
    expect(parseParams({ tex: "x", color: "#abc" }).color).toBe("#abc");
    expect(parseParams({ tex: "x", color: "DarkRed" }).color).toBe("DarkRed");
    expect(() => parseParams({ tex: "x", color: '"/><script>' })).toThrow(ParamError);
    expect(() => parseParams({ tex: "x", background: "url(x)" })).toThrow(ParamError);
  });

  test("format 只能是 svg 或 png", () => {
    expect(() => parseParams({ tex: "x", format: "gif" })).toThrow(ParamError);
  });

  test("参数类型不对时报错", () => {
    expect(() => parseParams({ tex: 1 })).toThrow(ParamError);
    expect(() => parseParams({ tex: "x", color: 1 })).toThrow(ParamError);
  });
});
