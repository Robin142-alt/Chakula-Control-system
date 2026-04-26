const target = process.argv[2] || "http://127.0.0.1:3000";

async function fetchJson(path) {
  const response = await fetch(`${target}${path}`);
  const body = await response.json();
  return {
    status: response.status,
    body,
  };
}

const [health, readiness] = await Promise.all([
  fetchJson("/api/health"),
  fetchJson("/api/readiness"),
]);

console.log(JSON.stringify({
  target,
  health,
  readiness,
}, null, 2));
