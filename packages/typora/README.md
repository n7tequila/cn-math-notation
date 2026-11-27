# cn-math-notation Typora 插件

在 [Typora](https://typora.io) 的公式里画中国中小学数学写法：竖式、递等式、短除法、树状图、十字相乘、综合除法。基于 [typora-community-plugin](https://github.com/typora-community-plugin/typora-community-plugin)。

Typora 内置的是 MathJax，不认识 `\shushi` 等命令；本插件让这些命令由 `@cn-math-notation/core` 画出来，其余公式照常交给 MathJax。

## 写法

本库命令**单独写成一个公式**，写法和 [使用说明](../../docs/usage.md) 完全一样：

```markdown
$$\shushi{403-167}$$

$$
\shushi*{
  7 4 \\
  + 8 8 \\
  \jin{1 1 ~} \\
  \hline
  1 6 2
}
$$

$$\dengshi{[100-(20+30)]\div5}$$

行内也可以：$\shushi{74+88}$
```

- 公式块里可以换行，`\\` 才是分行。
- 也能和普通公式写在同一个公式里，如 `74+88=162 \quad \shushi{74+88}`（插件往 Typora 的 MathJax 里注册本库命令；注册不上时会提示“本库命令要单独写成一个公式”，控制台有警告）。
- 写错时显示红色报错文字，内容和 KaTeX 插件一致。
- “复制为 MathML”：竖式得到 `mstack` / `mlongdiv`，短除法等只有朗读文字，递等式照常。

## 安装

1. 安装 typora-community-plugin。
2. 在插件市场里搜索 cn-math-notation 安装（[上架申请](https://github.com/typora-community-plugin/typora-plugin-releases/pull/25)合并后可用）；或者从 [发布仓库的 Releases](https://github.com/n7tequila/typora-plugin-cn-math-notation/releases) 下载 `plugin.zip`，在插件管理里手动安装并启用。
3. 重启 Typora。

## 已验证的版本

| Typora | typora-community-plugin 核心 |
|---|---|
| 1.14.16（macOS） | 2.10.21、2.10.86 |

Typora 没有提供“自定义公式命令”的接口，本插件包住了 Typora 内部调用的 MathJax 渲染函数（`tex2svg`、`tex2svgPromise`、`tex2mml`），并用 Typora 内部的刷新函数重画公式。这些都不是公开接口，**Typora 升级后可能失效**：竖式会显示成公式报错。插件找不到这些入口时会在开发者工具的控制台里给出 `[cn-math-notation]` 开头的警告。升级 Typora 后请打开 [手测文档](test/typora-sample.md) 看一眼。

## 开发

```bash
bun run build        # 打包到 dist/
bun run pack         # 另打 plugin.zip
bun run install:dev  # 装到本机 Typora（macOS），再在插件管理里启用、重启 Typora
```

插件版本（`package.json` 与 `src/manifest.json`，两处要一致）独立于库的版本。

发版：插件市场按 `repo` 根目录找 README、按纯版本号 tag 找 `plugin.zip`，所以版本发在独立的发布仓库 [n7tequila/typora-plugin-cn-math-notation](https://github.com/n7tequila/typora-plugin-cn-math-notation)（源码仍在这里）：

1. 两处版本号一起升，`bun run pack` 打出 `plugin.zip`。
2. 在发布仓库打纯版本号的 tag（如 `0.2.0`），建同名 Release，上传 `plugin.zip`（文件名固定）。
3. 发布仓库的 README 有改动时同步过去。

## 许可

[MIT](../../LICENSE)
