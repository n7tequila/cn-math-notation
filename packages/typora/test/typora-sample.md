# cn-math-notation Typora 插件手测

## 竖式

$$\shushi{403-167}$$

$$\shushi[multiCarry, colorByDigit]{538\times26}$$

$$\shushi{812\div4}$$

$$
\shushi*{
  7 4 \\
  + 8 8 \\
  \jin{1 1 ~} \\
  \hline
  1 6 2
}
$$

孩子的答案：

$$\shushi{403-167=346}$$

## 递等式

$$\dengshi{[100-(20+30)]\div5}$$

$$\dengshi[steps=1]{2\times3\times4+1}$$

$$\dengshi*{25\times(40+4) \\ 25\times40+25\times4 \\ 1100}$$

## 短除法、树状图

$$\duanchu[result]{36, 48}$$

$$\shuzhuang[split=half, result]{36}$$

## 十字相乘、综合除法

$$\shizi[result]{6x^2-7x-3}$$

$$\zonghe[result]{(x^3-2x^2+3)\div(x-1)}$$

## 行内

行内竖式 $\shushi{74+88}$ 和普通公式 $\frac{1}{2}+x^2$ 写在一起。

## 普通公式不受影响

$$\int_0^1 x^2\,dx = \frac{1}{3}$$

## 报错

$$\shushi{7+}$$

$$x+\shushi{7+}$$

## 混写（0.9.0 起）

竖式上下居中对着公式中线；深色主题下竖式跟着文字变色；“复制为 MathML”里竖式是 mstack。

$$74+88=162 \quad \shushi{74+88}$$

$$\text{商 } \shushi[round=2]{7\div3} \approx 2.33$$

$$x^2+\shizi{x^2+3x+2}=(x+1)(x+2)$$

$$S=\dengshi{2\times(3+4)}$$

行内混写：$1+\shushi{3+4}=8$ 写错了。

## 0.9.0 新写法

$$\dengshi{(3.6-1.6)\times0.25+1\div8}$$

$$\dengshi{2\times(3-5)-(-4)}$$

$$\shushi{3.50\times12}$$

$$\shushi{7\div3}$$

$$\shushi[repeatDot]{1\div7}$$
