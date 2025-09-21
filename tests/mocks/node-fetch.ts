const ensureFetch = (): typeof fetch => {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('globalThis.fetch is not available in this environment.');
  }
  return globalThis.fetch.bind(globalThis);
};

const fetchImpl: typeof fetch = (...args) => ensureFetch()(...args);

export default fetchImpl;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
