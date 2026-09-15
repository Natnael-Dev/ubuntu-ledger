import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const DOMAIN_ROOT = path.resolve(__dirname, "../../src/domain");

function getDomainSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getDomainSourceFiles(fullPath));
    } else if (
      /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

interface ImportViolation {
  file: string;
  line: number;
  specifier: string;
  reason: string;
}

function findImportViolations(filePath: string): ImportViolation[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const violations: ImportViolation[] = [];
  const relativeToRoot = path.relative(path.resolve(__dirname, "../.."), filePath);

  const FORBIDDEN_SPECIFIERS = [
    { pattern: /^(\.\.\/)+infra(\/|$)/, desc: "infra import via relative path" },
    { pattern: /^@\/infra(\/|$)/, desc: "infra import via alias" },
    { pattern: /^src\/infra(\/|$)/, desc: "infra import via src path" },
    { pattern: /^next(\/|$)/, desc: "Next.js framework import" },
    { pattern: /^@supabase(\/|$)/, desc: "Supabase client/DB import" },
    {
      pattern: /^(node:)?(fs|http|https|net|child_process|cluster|dgram|dns|tls)(\/|$)/,
      desc: "Node I/O module import",
    },
  ];

  function checkSpecifier(specifier: string, line: number) {
    // 1. Check explicit forbidden targets from 02-architecture.md §4 line 81
    for (const { pattern, desc } of FORBIDDEN_SPECIFIERS) {
      if (pattern.test(specifier)) {
        violations.push({
          file: relativeToRoot,
          line,
          specifier,
          reason: `Violates 02-architecture.md §4: /src/domain must not import from ${desc} ('${specifier}')`,
        });
        return;
      }
    }

    // 2. Check broader rule: src/domain imports nothing outside src/domain (09-agent.md §6 line 111)
    if (specifier.startsWith("@/")) {
      if (!specifier.startsWith("@/domain/") && specifier !== "@/domain") {
        violations.push({
          file: relativeToRoot,
          line,
          specifier,
          reason: `Violates 09-agent.md §6: alias import '${specifier}' points outside src/domain`,
        });
      }
    } else if (specifier.startsWith(".")) {
      const fileDir = path.dirname(filePath);
      const resolved = path.resolve(fileDir, specifier);
      const normalizedDomainRoot = path.normalize(DOMAIN_ROOT);
      const normalizedResolved = path.normalize(resolved);

      if (
        !normalizedResolved.startsWith(normalizedDomainRoot) &&
        normalizedResolved !== normalizedDomainRoot
      ) {
        violations.push({
          file: relativeToRoot,
          line,
          specifier,
          reason: `Violates 09-agent.md §6: relative import '${specifier}' escapes src/domain to ${path.relative(path.resolve(__dirname, "../.."), resolved)}`,
        });
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        checkSpecifier(node.moduleSpecifier.text, line);
      }
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      checkSpecifier(node.moduleSpecifier.text, line);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

describe("domain architecture boundary guard (T-02)", () => {
  it("verifies that /src/domain has zero forbidden imports", () => {
    const domainFiles = getDomainSourceFiles(DOMAIN_ROOT);
    const allViolations: ImportViolation[] = [];

    for (const file of domainFiles) {
      const violations = findImportViolations(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const formatted = allViolations
        .map((v) => `  - [${v.file}:${v.line}] '${v.specifier}': ${v.reason}`)
        .join("\n");
      expect.fail(
        `Architecture boundary violation detected in domain core:\n${formatted}`
      );
    }

    expect(allViolations).toHaveLength(0);
  });
});
