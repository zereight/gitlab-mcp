/**
 * Proxy bypass (NO_PROXY) unit tests
 * Tests the shouldBypassProxy() helper in gitlab-client-pool.ts
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldBypassProxy } from '../gitlab-client-pool.js';

describe('shouldBypassProxy', () => {
  // Wildcard "*"
  test('wildcard "*" bypasses all hosts', () => {
    assert.equal(shouldBypassProxy('gitlab.com', '*'), true);
    assert.equal(shouldBypassProxy('internal.corp', '*'), true);
  });

  // Exact matches
  test('exact hostname match', () => {
    assert.equal(shouldBypassProxy('localhost', 'localhost'), true);
    assert.equal(shouldBypassProxy('gitlab.com', 'gitlab.com'), true);
    assert.equal(shouldBypassProxy('other.com', 'gitlab.com'), false);
  });

  // Domain suffix with leading dot
  test('leading-dot pattern matches domain and its subdomains', () => {
    assert.equal(shouldBypassProxy('example.com', '.example.com'), true);
    assert.equal(shouldBypassProxy('sub.example.com', '.example.com'), true);
    assert.equal(shouldBypassProxy('deep.sub.example.com', '.example.com'), true);
    assert.equal(shouldBypassProxy('notexample.com', '.example.com'), false);
  });

  // Wildcard prefix "*.example.com"
  test('wildcard prefix "*.example.com" matches subdomains', () => {
    assert.equal(shouldBypassProxy('sub.example.com', '*.example.com'), true);
    assert.equal(shouldBypassProxy('example.com', '*.example.com'), true);
    assert.equal(shouldBypassProxy('other.com', '*.example.com'), false);
  });

  // Plain domain (no leading dot) — treated as suffix match
  test('plain domain entry matches itself and subdomains', () => {
    assert.equal(shouldBypassProxy('corp.internal', 'corp.internal'), true);
    assert.equal(shouldBypassProxy('api.corp.internal', 'corp.internal'), true);
    assert.equal(shouldBypassProxy('evil-corp.internal', 'corp.internal'), false);
  });

  // Comma-separated list
  test('comma-separated NO_PROXY list', () => {
    const noProxy = 'localhost,127.0.0.1,.internal.corp';
    assert.equal(shouldBypassProxy('localhost', noProxy), true);
    assert.equal(shouldBypassProxy('127.0.0.1', noProxy), true);
    assert.equal(shouldBypassProxy('api.internal.corp', noProxy), true);
    assert.equal(shouldBypassProxy('gitlab.com', noProxy), false);
  });

  // Whitespace handling
  test('entries with surrounding whitespace are trimmed', () => {
    assert.equal(shouldBypassProxy('localhost', ' localhost , 127.0.0.1 '), true);
    assert.equal(shouldBypassProxy('127.0.0.1', ' localhost , 127.0.0.1 '), true);
  });

  // Case insensitivity
  test('matching is case-insensitive', () => {
    assert.equal(shouldBypassProxy('GitLab.Com', 'gitlab.com'), true);
    assert.equal(shouldBypassProxy('gitlab.com', 'GitLab.Com'), true);
  });

  // Empty / missing values
  test('empty noProxy returns false', () => {
    assert.equal(shouldBypassProxy('gitlab.com', ''), false);
    assert.equal(shouldBypassProxy('gitlab.com', '   '), false);
  });

  test('empty hostname returns false', () => {
    assert.equal(shouldBypassProxy('', 'localhost'), false);
  });
});
