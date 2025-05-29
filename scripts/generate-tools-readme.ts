import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const indexPath = path.join(repoRoot, "index.ts");
  const readmePath = path.join(repoRoot, "README.md");

  // 1. Read index.ts
  const code = fs.readFileSync(indexPath, "utf-8");

  // 2. Extract allTools array block
  const match = code.match(/const allTools = \[([\s\S]*?)\];/);
  if (!match) {
    console.error("Unable to locate allTools array in index.ts");
    process.exit(1);
  }
  const toolsBlock = match[1];

  // 3. Parse tool entries
  const toolRegex = /name:\s*"([^"]+)",[\s\S]*?description:\s*"([^"]+)"/g;
  const tools: { name: string; description: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = toolRegex.exec(toolsBlock)) !== null) {
    tools.push({ name: m[1], description: m[2] });
  }

  // 4. Generate markdown
  const lines = tools.map((tool, index) => {
    return `${index + 1}. \`${tool.name}\` - ${tool.description}`;
  });
  const markdown = lines.join("\n");

  // 5. Read README.md and replace between markers
  const readme = fs.readFileSync(readmePath, "utf-8");
  const updated = readme.replace(
    /<!-- TOOLS-START -->([\s\S]*?)<!-- TOOLS-END -->/,
    `<!-- TOOLS-START -->\n${markdown}\n<!-- TOOLS-END -->`
  );

  // 6. Write back
  fs.writeFileSync(readmePath, updated, "utf-8");
  console.log("README.md tools section updated.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
