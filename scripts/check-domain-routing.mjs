const canonicalOrigin = "https://raredept.com.br";
const wwwOrigin = "https://www.raredept.com.br";
const maxRedirects = 5;
const mode = process.argv.includes("--expect-fixed") ? "expect-fixed" : "observe";

const cases = [
  { label: "apex HTTP /", url: "http://raredept.com.br/", expectedFinalStatus: 200 },
  { label: "apex HTTPS /", url: `${canonicalOrigin}/`, expectedFinalStatus: 200 },
  { label: "www HTTP /", url: "http://www.raredept.com.br/", expectsCanonicalRedirect: true, expectedFinalStatus: 200 },
  { label: "www HTTPS /", url: `${wwwOrigin}/`, expectsCanonicalRedirect: true, expectedFinalStatus: 200 },
  {
    label: "www /sobre com query",
    url: "http://www.raredept.com.br/sobre?utm_test=dominio",
    expectsCanonicalRedirect: true,
    expectedFinalStatus: 200,
  },
  {
    label: "www /contato com query",
    url: `${wwwOrigin}/contato?ref=domain`,
    expectsCanonicalRedirect: true,
    expectedFinalStatus: 200,
  },
  {
    label: "www 404 legitimo com query repetida",
    url: `${wwwOrigin}/caminho%20ficticio?tag=um&tag=dois&q=espaco%20codificado`,
    expectsCanonicalRedirect: true,
    expectedFinalStatus: 404,
  },
];

function canonicalUrl(input) {
  const url = new URL(input);
  url.protocol = "https:";
  url.host = "raredept.com.br";
  return url.href;
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

async function followRedirects(input) {
  const hops = [];
  let current = new URL(input);

  for (let index = 0; index <= maxRedirects; index += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "RARE-domain-readiness-check/1.0" },
    });
    const location = response.headers.get("location");

    hops.push({
      url: current.href,
      status: response.status,
      location: location ? new URL(location, current).href : null,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      cloudflareCache: response.headers.get("cf-cache-status"),
      railwayFallback: response.headers.get("x-railway-fallback"),
      poweredBy: response.headers.get("x-powered-by"),
    });

    if (response.body) await response.body.cancel();
    if (!isRedirect(response.status) || !location) return hops;
    if (index === maxRedirects) throw new Error(`Limite de ${maxRedirects} redirects excedido para ${input}`);
    current = new URL(location, current);
  }

  return hops;
}

function evaluate(testCase, hops) {
  const first = hops[0];
  const final = hops.at(-1);
  const failures = [];

  if (testCase.expectsCanonicalRedirect) {
    const expectedLocation = canonicalUrl(testCase.url);
    if (first.status !== 308) failures.push(`primeiro status ${first.status}; esperado 308`);
    if (first.location !== expectedLocation) {
      failures.push(`Location ${first.location ?? "ausente"}; esperado ${expectedLocation}`);
    }
  }

  if (final.url !== canonicalUrl(testCase.url)) failures.push(`destino final inesperado: ${final.url}`);
  if (final.status !== testCase.expectedFinalStatus) {
    failures.push(`status final ${final.status}; esperado ${testCase.expectedFinalStatus}`);
  }
  if (final.railwayFallback) failures.push("destino final ainda e fallback da Railway");
  if (final.poweredBy !== "Next.js") failures.push("destino final nao foi identificado como a aplicacao Next.js");

  return failures;
}

let failures = 0;
console.log(`RARE domain routing check (${mode})`);

for (const testCase of cases) {
  try {
    const hops = await followRedirects(testCase.url);
    const problems = evaluate(testCase, hops);
    const final = hops.at(-1);
    const chain = hops.map((hop) => `${hop.status} ${hop.url}`).join(" -> ");

    console.log(`\n${problems.length ? "FAIL" : "PASS"} ${testCase.label}`);
    console.log(`  chain: ${chain}`);
    console.log(`  final: ${final.status} ${final.url}`);
    console.log(`  origin: ${final.railwayFallback ? "Railway fallback" : final.poweredBy ?? "not identified"}`);
    for (const problem of problems) console.log(`  - ${problem}`);
    failures += problems.length ? 1 : 0;
  } catch (error) {
    failures += 1;
    console.log(`\nERROR ${testCase.label}`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\nSummary: ${cases.length - failures}/${cases.length} scenarios match the target state.`);
if (mode === "expect-fixed" && failures) process.exitCode = 1;
