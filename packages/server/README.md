# cn-math-notation 出图服务

一个很小的 HTTP 服务：传入公式，返回 SVG 或 PNG 图片。可以直接写进 `<img src>` 或 Markdown 的图片链接里，在不支持 KaTeX 的地方（微信、Word、邮件、Obsidian 等）显示竖式。

支持本库全部写法（竖式、递等式、短除法、树状图、十字相乘、综合除法），普通 TeX 公式也能出图（交给服务端的 MathJax 4）。

MathJax 加载的宏包与 Typora 一致（`\boldsymbol`、`\cancel`、`\ce`、`physics` 等都能用），只有几个有意不同：能往 SVG 里写 HTML、链接、样式的 `texhtml`、`html`（`\href`、`\style`、`\class`）不加载；未定义的命令返回 400，而不是像 Typora 那样画成红字。清单见 `src/tex-packages.ts`。另外：

- 交互命令（`\mathtip`、`\toggle` 等，`action` 宏包）不加载，图片里没有交互。
- 公式编号（`\tag`）不支持，返回 400：MathJax 的编号靠外层容器宽度排到右边，单独成图会被裁掉。
- 每个请求用独立的 MathJax，`\newcommand`、`\def`、`\definecolor` 只在本次请求里有效。
- 输出的 SVG 会清理：去掉外部链接（如 `\mmlToken` 的 `href`）和带外部地址的 CSS（如 `\bbox[background:url(…)]`），属性里的 `<` `>` 一律转义。

## 启动

```bash
bun run server                       # 在仓库根目录；默认 http://127.0.0.1:5178
HOST=0.0.0.0 PORT=8080 bun run server  # 改监听地址与端口
```

Docker（在仓库根目录构建）：

```bash
docker build -f packages/server/Dockerfile -t cn-math-notation-server .
docker run --rm -p 127.0.0.1:5178:5178 cn-math-notation-server
```

**没有鉴权、没有限流。** 默认只监听本机；要给局域网或外网用，请放在有鉴权、限流的反向代理后面。

## 接口

| 方法与地址 | 说明 |
|---|---|
| `GET /render.svg?tex=…` | 返回 SVG |
| `GET /render.png?tex=…` | 返回 PNG |
| `POST /render` | 请求体 JSON，`format` 决定返回 SVG 还是 PNG；适合长公式 |
| `GET /health` | 健康检查 |

参数（查询串或 JSON 字段）：

| 参数 | 默认 | 说明 |
|---|---|---|
| `tex` | 必填 | 公式，最多 2000 个字符。本库命令要单独写成一个公式，如 `\shushi{403-167}` |
| `format` | `svg` | `svg` / `png`（只对 `POST /render` 有用） |
| `size` | `24` | 每 em 多少像素，8～128。竖式一格约 1em |
| `color` | `#000` | 文字与线条颜色：十六进制色值或英文颜色名 |
| `background` | `transparent` | PNG 底色，写法同 `color`；SVG 不画底色 |

出图每边最多 4096 像素，超出时请减小 `size`。

例子：

```bash
curl -G http://127.0.0.1:5178/render.png --data-urlencode 'tex=\shushi{403-167}' -o shushi.png
curl http://127.0.0.1:5178/render -H 'content-type: application/json' \
  -d '{"tex":"\\dengshi{[100-(20+30)]\\div5}","format":"png","size":32,"background":"white"}' -o dengshi.png
```

```markdown
![403−167](http://127.0.0.1:5178/render.svg?tex=%5Cshushi%7B403-167%7D)
```

出错时返回 JSON（HTTP 400 / 404 / 405 / 413 / 500）：

```json
{ "success": false, "data": null, "error": "\\shushi：这里应该是数字" }
```

同一公式同一参数的出图结果不变，图片响应带 `Cache-Control: public, max-age=86400`。

## PNG 的字体

PNG 只用 `fonts/` 里的内置字体，不读系统字体，所以任何机器（包括 Docker）出图都一样。字体来源与改动见 [fonts/README.md](fonts/README.md)。core 新增了中文字或符号时，要重跑 `bun run fonts <源字体目录>` 重新裁剪。

PNG 的中文覆盖 GB2312 一级常用字（3755 个）、全角标点和 core 用到的字，`\text{米}`、`\text{千克}` 等单位都能画。公式里有字体没有的字（如二级字“鑫”）时，PNG 返回 400 并列出缺的字，请改用 SVG（SVG 由看图的电脑用自己的字体显示）。
