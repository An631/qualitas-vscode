#!/usr/bin/env node
// Format source files.
// Usage:
//   node scripts/format.js                     # format all files
//   node scripts/format.js file1.ts file2.js   # format only specified files

const { execSync } = require("child_process");
const { extname, join } = require("path");

const prettier = join(__dirname, "..", "node_modules", ".bin", "prettier");

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch {
    // Allow formatter commands to fail gracefully
  }
}

const files = process.argv.slice(2);

if (files.length === 0) {
  console.log("Formatting typescript files...");
  run(`${prettier} --write "src/**/*.ts" "test/**/*.ts"`);
  process.exit(0);
}

const tsFiles = files.filter((f) =>
  [".ts", ".js", ".mjs", ".cjs"].includes(extname(f)),
);
const pkgJsonFiles = files.filter((f) => f.endsWith("package.json"));

for (const pkgFile of pkgJsonFiles) {
  const dir = require("path").dirname(pkgFile) || ".";
  console.log(`Running npm pkg fix in ${dir}...`);
  run(`npm pkg fix --prefix ${dir}`);
}

if (tsFiles.length > 0) {
  console.log("Formatting typescript files...");
  run(`${prettier} --write ${tsFiles.join(" ")}`);
}
