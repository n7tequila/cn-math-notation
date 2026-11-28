# 发版

本仓有三样东西要发，版本号各自独立：

| 发什么 | 在哪 | 版本号写在 |
|---|---|---|
| `@cn-math-notation/core`、`@cn-math-notation/katex` | npm | `packages/core/package.json`、`packages/katex/package.json`（katex 依赖的 core 版本同步改） |
| Typora 插件 | 独立发布仓库 [n7tequila/typora-plugin-cn-math-notation](https://github.com/n7tequila/typora-plugin-cn-math-notation) 的 Release | `packages/typora/package.json` 与 `packages/typora/src/manifest.json`（两处一致） |
| 出图服务 | 不发 npm，只给 Dockerfile | — |

发版、改 PR、删 Release、npm publish 都是对外操作，先问维护者；npm publish 由维护者本人执行。

## 发版前

1. 做一轮代码审查（正确性 + 安全），发现先写成失败的测试再修。记录写进设计草案（如 §15、§16）。
2. 改动涉及 Typora 时，维护者在 Typora 里打开 `packages/typora/test/typora-sample.md` 手测（插件用 `cd packages/typora && bun run install:dev` 装到本机，重启 Typora）。
3. 想清楚已发布版本的影响：有安全问题时立即发修复版，并在旧版 Release 说明里加警告。

## npm（core、katex）

1. 升版本号：core 与 katex 的 `version`，以及 katex 里 `"@cn-math-notation/core": "^x.y.z"`。版本号必须先升，否则 publish 报 403。
2. 仓库根目录 `bun install && bun run check`（构建 + 类型检查 + 全部测试），提交推送。
3. 维护者发布，先 core 后 katex：
   ```bash
   cd packages/core && npm publish --auth-type=web
   cd ../katex && npm publish --auth-type=web
   ```
   - 登录过期时先 `npm login --auth-type=web --registry=https://registry.npmjs.org/`；`npm whoami --registry=https://registry.npmjs.org/` 查是否登录。
   - 本机 npm 默认镜像可能不是官方源；两个包的 `publishConfig` 已写死官方源。
4. 冒烟：在临时目录 `npm install @cn-math-notation/katex@x.y.z katex@0.19.1 --prefer-online --registry=https://registry.npmjs.org/`，`npm ls` 核对装上的 core 版本，再渲染几条新写法确认。

## Typora 插件

插件市场按发布仓库根目录的 README、按纯版本号 tag 下载 `plugin.zip`，所以发在独立仓库（源码仍在本仓 `packages/typora`）。

1. 两处版本号一起升，`cd packages/typora && bun run pack`，得到 `packages/typora/plugin.zip`（已被 .gitignore）。
2. 克隆发布仓库（`gh repo clone n7tequila/typora-plugin-cn-math-notation`），同步 `manifest.json`（与 README，如有改动），提交推送。
3. 打纯版本号 tag 并发布：`gh release create 0.2.0 plugin.zip --title 0.2.0 --notes-file <说明>`（文件名固定为 `plugin.zip`）。
4. 说明里写清新写法、修复（尤其已发布版本的问题）与 API 变化。

## 出图服务

```bash
docker build -f packages/server/Dockerfile -t cn-math-notation-server .   # 在仓库根目录
docker run --rm -p 127.0.0.1:5178:5178 cn-math-notation-server
```

core 新增了中文字或符号时，先在 `packages/server` 重跑 `bun run fonts <源字体目录>` 裁剪 PNG 用的内置字体（见 `packages/server/fonts/README.md`）。
