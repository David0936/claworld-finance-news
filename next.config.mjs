/** @type {import('next').NextConfig} */
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "claworld-Financial-Newa";

const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages 需要静态导出；Vercel 使用标准 Next.js 构建产物。
  ...(isPages ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  // GitHub Pages 是项目页（/<repo>/ 子路径），本地/Vercel 走根路径
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : "",
};

export default nextConfig;
