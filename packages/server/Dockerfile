# 在仓库根目录构建：docker build -f packages/server/Dockerfile -t cn-math-notation-server .
# 运行：docker run --rm -p 127.0.0.1:5178:5178 cn-math-notation-server
FROM oven/bun:1.3.12-slim
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
# lockfile 记着全部 workspace 包，只复制其他包的清单（不复制源码），--frozen-lockfile 才对得上
COPY packages/katex/package.json packages/katex/
COPY packages/typora/package.json packages/typora/
COPY packages/playground/package.json packages/playground/
COPY packages/core packages/core
COPY packages/server packages/server
RUN bun install --frozen-lockfile --production --filter @cn-math-notation/server
ENV HOST=0.0.0.0 PORT=5178
EXPOSE 5178
USER bun
CMD ["bun", "run", "packages/server/src/main.ts"]
