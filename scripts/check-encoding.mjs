import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const rootDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ignoredDirs = new Set([
  ".git",
  ".npm-verify",
  ".npm-verify-cache",
  "dist",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".venv"
]);
const checkedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".ts",
  ".tsx",
  ".vue"
]);
const suspiciousTokens = [
  "�",
  "锟斤拷",
  "闈",
  "鐨",
  "鏂囨",
  "妗",
  "瀹夎",
  "鍦ㄥ",
  "涓€",
  "銆",
  "锛",
  "乣",
  "Ã",
  "Â",
  "â€"
];

const findings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(join(dir, entry.name));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const filePath = join(dir, entry.name);
    const relativePath = relative(rootDir, filePath).split(sep).join("/");

    if (relativePath === "scripts/check-encoding.mjs" || !checkedExtensions.has(extname(entry.name))) {
      continue;
    }

    await checkFile(filePath, relativePath);
  }
}

async function checkFile(filePath, relativePath) {
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matchedToken = suspiciousTokens.find((token) => line.includes(token));

    if (matchedToken) {
      findings.push({
        file: relativePath,
        line: index + 1,
        token: matchedToken,
        text: line.trim().slice(0, 160)
      });
    }
  });
}

await walk(rootDir);

if (findings.length > 0) {
  console.error("发现疑似编码乱码，请先修复后再发布：");

  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} token=${JSON.stringify(finding.token)} ${finding.text}`);
  }

  process.exit(1);
}

console.log("编码检查通过，未发现常见乱码特征。");
