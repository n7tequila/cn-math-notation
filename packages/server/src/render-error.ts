/** 公式写错、出图太大等调用方能改正的错误（返回 400）。 */
export class RenderError extends Error {
  override readonly name = "RenderError";
}
