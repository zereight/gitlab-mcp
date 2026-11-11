import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { PaginationOptionsSchema } from "../../schemas.js";
import {
  encodeGitLabPath,
  encodeGitLabPathSegment,
  normalizeGitLabApiUrl,
  resolveGitLabApiRequestUrl,
} from "../../utils/url.js";
import {
  appendFilterParam,
  cleanMutuallyExclusiveIdUsernameOptions,
  dropBlankArrayEntries,
  isBlankFilterValue,
  LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS,
  sanitizeToolArguments,
} from "../../utils/tool-args.js";

const RUN = { seed: 20261111, numRuns: 100 };

const SEGMENT_ERROR = /^Cannot use value as a GitLab URL path segment:/;
const PATH_ERROR = /^Cannot use value as a GitLab URL path:/;
const API_PATH_ERROR = /^(GitLab API path|Cannot use value as a GitLab URL path)/;

// eslint-disable-next-line no-control-regex
const UNSAFE_SEGMENT_CHARACTER = /[%/\\\u0000-\u001f\u007f]/;
const isSafeSegment = (value: string): boolean =>
  !UNSAFE_SEGMENT_CHARACTER.test(value) && value !== "." && value !== "..";

const SAFE_SEGMENT = fc.string({ unit: "grapheme", maxLength: 12 }).filter(isSafeSegment);
const NON_EMPTY_SAFE_SEGMENT = SAFE_SEGMENT.filter(value => value.length > 0);
const CONTROL_CHARACTER = fc
  .oneof(fc.integer({ min: 0, max: 31 }), fc.constant(127))
  .map(code => String.fromCharCode(code));
const ADVERSARIAL_SEGMENT = fc.stringMatching(/^[%/\\.2Ea-f0-9]{0,16}$/);
const ADVERSARIAL_PATH = fc.stringMatching(/^[%/\\.:?#@2Ea-z0-9]{0,24}$/);
const WEB_URL = fc.webUrl({ withFragments: false, withQueryParameters: false });

const NON_BLANK_STRING = fc.string().filter(value => value.trim() !== "");
const BLANK_STRING = fc.stringMatching(/^[ \t\r\n]*$/);

function encodeTimes(value: string, times: number): string {
  let encoded = value;
  for (let index = 0; index < times; index++) {
    encoded = encodeURIComponent(encoded);
  }
  return encoded;
}

describe("When PaginationOptionsSchema parses generated input", () => {
  test("should never throw from safeParse and keep only pagination keys", () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        const result = PaginationOptionsSchema.safeParse(value);
        if (result.success) {
          for (const key of Object.keys(result.data)) {
            assert.ok(key === "page" || key === "per_page");
          }
        }
      }),
      RUN
    );
  });

  test("should accept omitted or undefined pagination fields and keep their values", () => {
    fc.assert(
      fc.property(
        fc.record({
          page: fc.option(fc.integer(), { nil: undefined }),
          per_page: fc.option(fc.integer(), { nil: undefined }),
        }),
        input => {
          const parsed = PaginationOptionsSchema.parse(input);
          assert.equal(parsed.page, input.page);
          assert.equal(parsed.per_page, input.per_page);
        }
      ),
      RUN
    );
  });

  test("should coerce an integer and its string form to the same number", () => {
    fc.assert(
      fc.property(fc.constantFrom("page", "per_page"), fc.integer(), (key, value) => {
        assert.equal(PaginationOptionsSchema.parse({ [key]: value })[key], value);
        assert.equal(PaginationOptionsSchema.parse({ [key]: String(value) })[key], value);
      }),
      RUN
    );
  });

  test("should report non-numeric and non-finite values as validation failures", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("page", "per_page"),
        fc.oneof(
          fc.stringMatching(/^[a-z]{1,8}$/),
          fc.constantFrom("Infinity", "-Infinity", "1e400", Infinity, -Infinity)
        ),
        (key, value) => {
          assert.equal(PaginationOptionsSchema.safeParse({ [key]: value }).success, false);
        }
      ),
      RUN
    );
  });
});

describe("When GitLab URL path helpers encode generated input", () => {
  test("should encode a plain segment exactly as encodeURIComponent", () => {
    fc.assert(
      fc.property(SAFE_SEGMENT, value => {
        const encoded = encodeGitLabPathSegment(value);
        assert.equal(encoded, encodeURIComponent(value));
        assert.equal(decodeURIComponent(encoded), value);
      }),
      RUN
    );
  });

  test("should return a canonical encoded segment or reject the input", () => {
    fc.assert(
      fc.property(ADVERSARIAL_SEGMENT, value => {
        let encoded: string;
        try {
          encoded = encodeGitLabPathSegment(value);
        } catch (error) {
          assert.match((error as Error).message, SEGMENT_ERROR);
          return;
        }
        assert.doesNotMatch(encoded, /[/\\]/);
        assert.equal(encodeURIComponent(decodeURIComponent(encoded)), encoded);
      }),
      RUN
    );
  });

  test("should reject dot segments, leading separators, and control characters", () => {
    const rejected = fc.oneof(
      fc.constantFrom(".", "..", "%2E", "%2e%2E", "%252E%252E"),
      SAFE_SEGMENT.map(value => `/${value}`),
      SAFE_SEGMENT.map(value => `\\${value}`),
      fc.tuple(SAFE_SEGMENT, SAFE_SEGMENT).map(([head, tail]) => `${head}/../${tail}`),
      fc.tuple(SAFE_SEGMENT, SAFE_SEGMENT).map(([head, tail]) => `${head}%2F..%2F${tail}`),
      fc.tuple(SAFE_SEGMENT, CONTROL_CHARACTER, SAFE_SEGMENT).map(([head, char, tail]) => {
        return `${head}${char}${tail}`;
      })
    );
    fc.assert(
      fc.property(rejected, value => {
        assert.throws(() => encodeGitLabPathSegment(value), { message: SEGMENT_ERROR });
      }),
      RUN
    );
  });

  test("should decode up to the pass limit and reject deeper encodings", () => {
    fc.assert(
      fc.property(
        SAFE_SEGMENT.filter(value => encodeURIComponent(value) !== value),
        fc.integer({ min: 0, max: 5 }),
        (value, layers) => {
          const input = encodeTimes(value, layers);
          if (layers <= 4) {
            assert.equal(encodeGitLabPathSegment(input), encodeURIComponent(value));
          } else {
            assert.throws(() => encodeGitLabPathSegment(input), { message: SEGMENT_ERROR });
          }
        }
      ),
      RUN
    );
  });

  test("should encode each segment of a valid path and reject empty segments", () => {
    fc.assert(
      fc.property(fc.array(NON_EMPTY_SAFE_SEGMENT, { minLength: 1, maxLength: 5 }), segments => {
        assert.equal(
          encodeGitLabPath(segments.join("/")),
          segments.map(segment => encodeURIComponent(segment)).join("/")
        );
      }),
      RUN
    );
    const emptySegmentPath = fc.oneof(
      fc.constant(""),
      SAFE_SEGMENT.map(value => `/${value}`),
      SAFE_SEGMENT.map(value => `${value}/`),
      fc.tuple(SAFE_SEGMENT, SAFE_SEGMENT).map(([head, tail]) => `${head}//${tail}`)
    );
    fc.assert(
      fc.property(emptySegmentPath, path => {
        assert.throws(() => encodeGitLabPath(path), { message: PATH_ERROR });
      }),
      RUN
    );
  });

  test("should normalize API URLs to end with /api/v4 without a trailing slash", () => {
    fc.assert(
      fc.property(WEB_URL, url => {
        const normalized = normalizeGitLabApiUrl(url);
        assert.ok(normalized.endsWith("/api/v4"));
        assert.equal(normalizeGitLabApiUrl(normalized), normalized);
      }),
      RUN
    );
  });

  test("should ignore a single trailing slash on an API URL", () => {
    fc.assert(
      fc.property(
        WEB_URL.filter(url => !url.endsWith("/")),
        url => {
          assert.equal(normalizeGitLabApiUrl(`${url}/`), normalizeGitLabApiUrl(url));
        }
      ),
      RUN
    );
  });

  test("should keep resolved request URLs on the API origin and /api/v4 base", () => {
    const apiBase = "https://gitlab.example.com/api/v4";
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ unit: "grapheme", maxLength: 24 }), ADVERSARIAL_PATH),
        rawPath => {
          let resolved: URL;
          try {
            resolved = resolveGitLabApiRequestUrl(apiBase, rawPath);
          } catch (error) {
            assert.match((error as Error).message, API_PATH_ERROR);
            return;
          }
          assert.equal(resolved.origin, "https://gitlab.example.com");
          assert.ok(resolved.pathname.startsWith("/api/v4/"));
          assert.equal(resolved.search, "");
          assert.equal(resolved.hash, "");
        }
      ),
      RUN
    );
  });
});

describe("When tool argument normalizers run on generated input", () => {
  test("should drop only top-level null and undefined arguments", () => {
    const toolName = fc.constantFrom("create_label", "update_label", "create_draft_note");
    const key = fc.oneof(
      fc.stringMatching(/^[a-z_]{1,8}$/),
      fc.constantFrom("priority", "color", "name")
    );
    const args = fc.dictionary(
      key,
      fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.integer(),
        fc.string(),
        fc.record({ nested: fc.constant(null) })
      )
    );
    fc.assert(
      fc.property(toolName, args, (name, input) => {
        const result = sanitizeToolArguments(name, input);
        const keepsNull = (argKey: string): boolean =>
          (name === "create_label" || name === "update_label") && argKey === "priority";
        for (const [argKey, value] of Object.entries(input)) {
          const kept = value !== undefined && (value !== null || keepsNull(argKey));
          assert.equal(Object.hasOwn(result, argKey), kept, argKey);
          if (kept) {
            assert.strictEqual(result[argKey], value);
          }
        }
      }),
      RUN
    );
  });

  test("should treat only undefined, whitespace-only strings and empty arrays as blank", () => {
    const blank = fc.oneof(
      fc.constant(undefined),
      BLANK_STRING,
      fc.array(fc.string(), { maxLength: 0 })
    );
    const nonBlank = fc.oneof(
      fc.integer(),
      fc.boolean(),
      NON_BLANK_STRING,
      fc.array(fc.string(), { minLength: 1 })
    );
    const sample = fc.oneof(
      blank.map(value => ({ value, expected: true })),
      nonBlank.map(value => ({ value, expected: false }))
    );
    fc.assert(
      fc.property(sample, ({ value, expected }) => {
        assert.equal(isBlankFilterValue(value), expected);
      }),
      RUN
    );
  });

  test("should keep the non-blank entries of an array in order", () => {
    const items = fc.array(
      fc.oneof(fc.string(), fc.stringMatching(/^[ \t]*$/), fc.integer(), fc.boolean())
    );
    fc.assert(
      fc.property(items, input => {
        const result = dropBlankArrayEntries(input);
        assert.deepEqual(
          result,
          input.filter(item => !(typeof item === "string" && item.trim() === ""))
        );
        assert.deepEqual(dropBlankArrayEntries(result), result);
      }),
      RUN
    );
  });

  test("should append a query parameter only when the normalized value is not blank", () => {
    const value = fc.oneof(
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.array(fc.string(), { maxLength: 4 })
    );
    fc.assert(
      fc.property(value, input => {
        const params = new URLSearchParams();
        appendFilterParam(params, "labels", input);
        const normalized = dropBlankArrayEntries(input);
        if (isBlankFilterValue(normalized)) {
          assert.equal(params.has("labels"), false);
        } else {
          assert.deepEqual(params.getAll("labels"), [String(normalized)]);
        }
      }),
      RUN
    );
  });

  test("should drop the id filter when its username filter has a non-blank value", () => {
    const pair = fc.constantFrom(...LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS);
    const username = fc.oneof(
      NON_BLANK_STRING,
      fc.tuple(BLANK_STRING, NON_BLANK_STRING).map(([blank, text]) => [blank, text])
    );
    fc.assert(
      fc.property(pair, fc.integer({ min: 1 }), username, ([idKey, usernameKey], id, name) => {
        const options: Record<string, unknown> = { [idKey]: id, [usernameKey]: name };
        const snapshot = structuredClone(options);
        const cleaned = cleanMutuallyExclusiveIdUsernameOptions(
          options,
          LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS
        );
        assert.equal(Object.hasOwn(cleaned, idKey), false);
        assert.deepEqual(cleaned[usernameKey], name);
        assert.deepEqual(options, snapshot);
      }),
      RUN
    );
  });

  test("should keep the id filter when its username filter is blank", () => {
    const pair = fc.constantFrom(...LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS);
    const username = fc.oneof(
      fc.constant(undefined),
      BLANK_STRING,
      fc.array(BLANK_STRING, { maxLength: 3 })
    );
    fc.assert(
      fc.property(pair, fc.integer({ min: 1 }), username, ([idKey, usernameKey], id, name) => {
        const cleaned = cleanMutuallyExclusiveIdUsernameOptions(
          { [idKey]: id, [usernameKey]: name },
          LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS
        );
        assert.equal(cleaned[idKey], id);
      }),
      RUN
    );
  });
});
