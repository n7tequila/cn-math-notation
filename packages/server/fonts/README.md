# 内置字体

PNG 出图用，由 `scripts/build-fonts.ts` 生成。全部以 SIL Open Font License 1.1 发布，许可原文在同目录。

| 文件 | 来源 | 改动 | 许可 |
|---|---|---|---|
| `CMNSans-Regular.otf` | Noto Sans（[google/fonts](https://github.com/google/fonts/tree/main/ofl/notosans)）+ Noto Sans SC（[notofonts/noto-cjk](https://github.com/notofonts/noto-cjk)） | 中文裁剪到 core 用字 + GB2312 一级常用字 + 全角标点；可变字体固定为常规字重；两款字形合并为一个字体，改名为 CMN Sans | `NotoSans-OFL.txt`、`NotoSansSC-OFL.txt` |
| `CMNSans-Italic.otf` | Noto Sans Italic + Noto Sans SC | 西文为斜体字形，中文只带 core 用字 | 同上 |
| `STIXTwoText.ttf`、`STIXTwoText-Italic.ttf` | STIX Two Text（[google/fonts](https://github.com/google/fonts/tree/main/ofl/stixtwotext)） | 未改动 | `STIXTwoText-OFL.txt` |

合并的原因：resvg 2.6 在一行文字里遇到斜体字体缺的字（如“商”）时，会整行改用别的字体，斜体变成直立；中文字体自带的 × 等符号是全角宽度。详见 `scripts/merge-fonts.ts`。

`charset.txt` 是常规体能画的非 ASCII 字符，出图服务据此拒绝 PNG 画不出的字。
