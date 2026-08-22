import fs from "node:fs";

const mainPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const aliasPath = "packages/gitlab-mcp/package.json";
const aliasPkg = JSON.parse(fs.readFileSync(aliasPath, "utf8"));

aliasPkg.version = mainPkg.version;
aliasPkg.dependencies["@zereight/mcp-gitlab"] = mainPkg.version;

fs.writeFileSync(aliasPath, `${JSON.stringify(aliasPkg, null, 2)}\n`);
