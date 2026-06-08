# 实时推文 worker 的独立镜像（与 Vercel 上的 Next 站点分开部署）。
# 用于 Railway / Fly / Render 等 always-on 平台。纯 Node，无 npm 依赖。
#
# 本地构建/运行：
#   docker build -f worker.Dockerfile -t ffc-worker .
#   docker run -p 8080:8080 \
#     -e TWITTER_API_KEY=xxx -e FEISHU_WEBHOOK=xxx \
#     -e SITE_URL=https://claworld-financial-newa.vercel.app/tweets/ ffc-worker
FROM node:20-slim
WORKDIR /app

# worker 脚本 + A股检测模块 + 种子数据（推文种子、A股白名单种子）
COPY scripts/realtime-worker.mjs ./scripts/realtime-worker.mjs
COPY scripts/ashare-match.mjs ./scripts/ashare-match.mjs
COPY scripts/handles.json ./scripts/handles.json
COPY data/live/aleabitoreddit.tweets.json ./data/live/aleabitoreddit.tweets.json
COPY data/ashares.json ./data/ashares.json

ENV PORT=8080
ENV POLL_INTERVAL=15
ENV X_HANDLE=aleabitoreddit
EXPOSE 8080

CMD ["node", "scripts/realtime-worker.mjs"]
