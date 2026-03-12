#!/usr/bin/env node

/**
 * Syncs the project files into cli/template/ for npm publishing.
 * Run this before `npm publish` from the cli/ directory.
 *
 * Usage: node sync-template.js
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const TEMPLATE_DIR = path.join(__dirname, "template");

const IGNORE = new Set([
    "node_modules",
    "dist",
    ".git",
    ".env",
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local",
    "cli",
    "package-lock.json",
    "Topaz.png",
    "plan.md",
    "history.md",
    ".claude",
    ".vscode",
]);

const IGNORE_PATTERNS = [/^load-test-report-.*\.json$/, /^\.env\..+\.local$/];

function shouldIgnore(name, relativePath) {
    if (IGNORE.has(name)) return true;
    for (const pattern of IGNORE_PATTERNS) {
        if (pattern.test(name)) return true;
    }
    // Ignore generated prisma files
    if (relativePath.startsWith(path.join("src", "generated"))) return true;
    // Ignore dashboard build output and node_modules
    if (
        relativePath.startsWith(path.join("dashboard", "node_modules")) ||
        relativePath.startsWith(path.join("dashboard", "dist"))
    )
        return true;
    return false;
}

function copyRecursive(src, dest, relativePath = "") {
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src);
        for (const entry of entries) {
            const entryRelative = path.join(relativePath, entry);
            if (!shouldIgnore(entry, entryRelative)) {
                copyRecursive(path.join(src, entry), path.join(dest, entry), entryRelative);
            }
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

console.log("🔄 Syncing project files to cli/template/...\n");

cleanDir(TEMPLATE_DIR);
copyRecursive(PROJECT_ROOT, TEMPLATE_DIR);

// Count files
let fileCount = 0;
function countFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            countFiles(path.join(dir, entry.name));
        } else {
            fileCount++;
        }
    }
}
countFiles(TEMPLATE_DIR);

console.log(`✅ Synced ${fileCount} files to cli/template/`);
console.log('\nReady to publish! Run "npm publish" from the cli/ directory.');
