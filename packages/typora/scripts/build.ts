/**
 * 打包 Typora 插件：src/main.ts → dist/main.js（ESM，typora-community-plugin 用 import() 加载）。
 *   --pack     另打 plugin.zip（main.js + manifest.json），供手动安装或发 GitHub Releases
 *   --install  装到本机 Typora 的插件目录（macOS），装完需重启 Typora 并在插件管理里启用
 */
import { cp, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");
const MANIFEST = join(ROOT, "src", "manifest.json");
const manifest = (await Bun.file(MANIFEST).json()) as { id: string; version: string };
const pkg = (await Bun.file(join(ROOT, "package.json")).json()) as { version: string };
if (manifest.version !== pkg.version) {
  throw new Error(`manifest.json 版本 ${manifest.version} 与 package.json 版本 ${pkg.version} 不一致`);
}

await rm(DIST, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [join(ROOT, "src", "main.ts")],
  outdir: DIST,
  format: "esm",
  target: "browser",
  minify: true,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("打包失败");
}
await cp(MANIFEST, join(DIST, "manifest.json"));
console.log(`已打包 ${manifest.id} ${manifest.version} → dist/`);

const args = new Set(process.argv.slice(2));
if (args.has("--pack")) {
  const zip = join(ROOT, "plugin.zip");
  await rm(zip, { force: true });
  await $`zip -j -q ${zip} ${join(DIST, "main.js")} ${join(DIST, "manifest.json")}`;
  console.log("已生成 plugin.zip");
}
if (args.has("--install")) {
  if (process.platform !== "darwin") throw new Error("--install 只支持 macOS；其他系统请用 plugin.zip 手动安装");
  const target = join(homedir(), "Library/Application Support/abnerworks.Typora/plugins/plugins", manifest.id);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(join(DIST, "main.js"), join(target, "main.js"));
  await cp(MANIFEST, join(target, "manifest.json"));
  console.log(`已安装到 ${target}`);
}
