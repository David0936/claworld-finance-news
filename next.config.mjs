/** @type {import('next').NextConfig} */
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "claworld-Financial-Newa";

const nextConfig = {
  reactStrictMode: true,
  // 静态导出，产出 out/ 目录，适配 GitHub Pages / 任意静态托管
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // GitHub Pages 是项目页（/<repo>/ 子路径），本地/Vercel 走根路径
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : "",
};

export default nextConfig;
