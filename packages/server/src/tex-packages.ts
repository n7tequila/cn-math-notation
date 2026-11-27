/**
 * 服务端 MathJax 加载的 TeX 宏包：与 Typora 1.14 内置的 MathJax 4（tex-svg-full + physics）一致。
 * Typora 默认加载 base、ams、newcommand、textmacros、configmacros，其余宏包用到时自动加载；
 * 服务端没有组件加载器，所以一开始就全部导入。
 *
 * 不加载（有意与 Typora 不同）：
 * - texhtml、html：能往输出的 SVG 里写 HTML、链接（\href）、样式（\style、\class），对外服务有注入风险；
 *   其他宏包也能把用户文字抄进属性（\bbox 的 CSS、\mmlToken 的 href），由 svg-sanitize.ts 统一清理；
 * - noerrors、noundefined：把错误、未定义命令画成红字，服务端改为返回 400，调用方更容易发现写错；
 * - action（\mathtip、\toggle 等）：图片里没有交互，而且在服务端的 lite 适配器上会抛内部错误；
 * - require、autoload：依赖组件加载器，全部导入后用不着；
 * - colorv2：与 color 二选一，Typora 用 color；fontsizev3：不在 Typora 的列表里。
 */
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js";
import "@mathjax/src/js/input/tex/bbm/BbmConfiguration.js";
import "@mathjax/src/js/input/tex/bboldx/BboldxConfiguration.js";
import "@mathjax/src/js/input/tex/bbox/BboxConfiguration.js";
import "@mathjax/src/js/input/tex/begingroup/BegingroupConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/bussproofs/BussproofsConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/colortbl/ColortblConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/dsfont/DsfontConfiguration.js";
import "@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js";
import "@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js";
import "@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js";
import "@mathjax/src/js/input/tex/setoptions/SetOptionsConfiguration.js";
import "@mathjax/src/js/input/tex/tagformat/TagFormatConfiguration.js";
import "@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js";
import "@mathjax/src/js/input/tex/units/UnitsConfiguration.js";
import "@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js";
import "@mathjax/src/js/input/tex/verb/VerbConfiguration.js";

/** 交给 TeX 输入的宏包名（与上面的导入一一对应）。 */
export const TEX_PACKAGES: readonly string[] = [
  "base",
  "ams",
  "amscd",
  "bbm",
  "bboldx",
  "bbox",
  "begingroup",
  "boldsymbol",
  "braket",
  "bussproofs",
  "cancel",
  "cases",
  "centernot",
  "color",
  "colortbl",
  "configmacros",
  "dsfont",
  "empheq",
  "enclose",
  "extpfeil",
  "gensymb",
  "mathtools",
  "mhchem",
  "newcommand",
  "physics",
  "setoptions",
  "tagformat",
  "textcomp",
  "textmacros",
  "unicode",
  "units",
  "upgreek",
  "verb",
];
