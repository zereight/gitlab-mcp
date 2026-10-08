import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HTTP_STACK_SPECIFIERS = [
  "express",
  "express-rate-limit",
  "@modelcontextprotocol/sdk/server/sse.js",
  "@modelcontextprotocol/sdk/server/streamableHttp.js",
  "@modelcontextprotocol/sdk/server/auth/router.js",
  "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js",
];

function readServerEntry(): string {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  return readFileSync(path.join(directory, "../../index.ts"), "utf8");
}

function isValueImport(statement: ts.ImportDeclaration): boolean {
  const clause = statement.importClause;
  if (!clause) {
    return true;
  }
  if (clause.isTypeOnly) {
    return false;
  }
  if (clause.name) {
    return true;
  }
  const bindings = clause.namedBindings;
  if (!bindings) {
    return false;
  }
  if (ts.isNamespaceImport(bindings)) {
    return true;
  }
  return bindings.elements.some(element => !element.isTypeOnly);
}

function valueImportSpecifiers(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    "index.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const specifiers: string[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !isValueImport(statement)) {
      continue;
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    specifiers.push(statement.moduleSpecifier.text);
  }
  return specifiers;
}

function importsHttpStack(source: string): boolean {
  const specifiers = new Set(valueImportSpecifiers(source));
  return HTTP_STACK_SPECIFIERS.some(specifier => specifiers.has(specifier));
}

describe("When the server entry is loaded for stdio", () => {
  describe("with the top-level imports", () => {
    it("should not statically import the HTTP stack", () => {
      assert.equal(importsHttpStack(readServerEntry()), false);
    });
  });

  describe("with a multiline value import", () => {
    it("should treat the module as a static import", () => {
      const source = 'import express from\n  "express";\n';

      assert.equal(importsHttpStack(source), true);
    });
  });

  describe("with a type-only import", () => {
    it("should ignore the module", () => {
      const source = 'import type { Request } from "express";\n';

      assert.equal(importsHttpStack(source), false);
    });
  });
});
