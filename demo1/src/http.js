async function fetchJson(url, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = 800,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} from ${url}`);
      error.statusCode = response.status;
      error.payload = parsed;
      throw error;
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  fetchJson,
  sleep,
};