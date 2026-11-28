# cn-math-notation

中国中小学数学写法库：竖式、递等式、短除法、树状图、十字相乘、综合除法，以 LaTeX 命令（`\shushi{…}` 等）写进公式。
core 不依赖任何公式引擎，接入 KaTeX、Typora（MathJax）和出图服务。

## 先读哪里

| 要做什么 | 读 |
|---|---|
| 了解功能、路线图 | `README.md` |
| 全部命令、选项、报错 | `docs/usage.md` |
| 为什么这样画、维护者裁决、【推论】 | `docs/design/2026-11-19-设计草案.md`（§9 待定问题、§11 课本样本核对、§12 语义式、§13 Typora、§14 出图服务、§15～§16 代码审查） |
| 发版（npm、Typora 插件、Docker） | `docs/release.md`（发版由维护者负责） |
| Typora 插件的原理与限制 | `packages/typora/README.md` |
| 出图服务的接口、字体 | `packages/server/README.md`、`packages/server/fonts/README.md` |

## 仓库结构

```
packages/core        模型、解析、SVG/MathML 渲染（发 npm）
packages/katex       KaTeX 插件（发 npm，锁 KaTeX ~0.19.1）
packages/typora      Typora 插件（不发 npm，打 plugin.zip）
packages/server      出图服务（不发 npm，Bun + MathJax 4 + resvg）
packages/playground  试写页
```

## 常用命令（仓库根目录）

```bash
bun run check        # 构建 + 五个包的类型检查 + 全部测试；提交前必须通过
bun test             # 只跑测试
bun run playground   # 试写页 http://localhost:5177（新增源文件后要重启）
bun run server       # 出图服务 http://127.0.0.1:5178
bun run docs:images  # 重新生成 docs/images 里的示例图
cd packages/typora && bun run install:dev   # 插件装到本机 Typora（macOS），重启后生效
```

## 工作方式

- 一次只做一件事；开工前把要裁决的点问清楚（给选项和推荐项），裁决记进设计草案。自己补定的细节标 **【推论】**，汇报时点明。
- 默认写法以沪教版课本为准；课本样本放 `docs/samples/`，有版权，**不进仓库**（已被 .gitignore）。
- 写了孩子的答案时默认不画过程；渲染器不校验对错，直写布局写什么画什么。
- 测试先行：问题先写成失败的测试再修；“全部通过 / 没有发现”类检查要加对照组，确认测法本身有效。
- 自己算的例子要核对；渲染后截图看一遍再汇报（出图服务出 PNG，或试写页截图）。

## 容易踩的坑

- **测试里含汉字、× 等非 ASCII 字符时别用 `String.raw`**：Bun 会把它们写成 `\uXXXX`，测试假通过。
- **Typora 与出图服务都加载了 MathJax 的 physics 宏包**，它把 `\div` 改成散度 `∇·`；本库生成的 TeX 直接写 `÷`。
- **Typora 里的 MathJax 只有默认宏包**（base、ams、newcommand、configmacros，其余用到才自动加载，mathtools 的 `\mathllap` 等不可用）；生成给 MathJax 的 TeX 只用这些里的命令，`packages/server/test/mathjax.test.ts` 有对应测试。
- **MathJax 4 会自动换行**：行内公式和太宽的显示公式会拆成好几个 `<svg>`，处理输出时要遍历整个容器。
- **混写的安全**：Typora 插件对 MathJax 输出要直接操作 DOM，不要把序列化后的字符串改完再赋回去（WebKit 序列化属性值时不转义 `>`，会被注入）；只认 `data-cmn-tex` 并按原命令重画，不信任携带的 SVG。出图服务先 `svg-sanitize.ts` 清理再插入。详见设计草案 §16。
- 出图服务不加载 html/texhtml 宏包；MathJax 输出必须经 `svg-sanitize.ts`；语义式算式每个数最多 30 位（防 DoS）。
- PNG 只用 `packages/server/fonts/` 的内置字体；core 新增中文字后在 `packages/server` 跑 `bun run fonts <源字体目录>`。
- KaTeX 的 `aligned` 不支持 `[t]`，`\mathllap` 会把等号排低；KaTeX 侧的变通见 `katexMixedDengshi`。

## 提交

- 提交信息用 `feat:` / `fix:` / `docs:` / `chore:` 等前缀，英文。
- 本仓公开：提交前 `git grep` 确认没有外部私有项目的名字或内部编号。
