import { describe, expect, it } from "vitest";
import { getMelhorEnvioBaseUrlIssue } from "@/lib/melhor-envio-endpoint";

const production = { APP_ENV: "production", NODE_ENV: "production", MELHOR_ENVIO_ENV: "production" };
const staging = { APP_ENV: "staging", NODE_ENV: "production", MELHOR_ENVIO_ENV: "sandbox" };
const development = { APP_ENV: "development", NODE_ENV: "development", MELHOR_ENVIO_ENV: "sandbox" };

describe("getMelhorEnvioBaseUrlIssue", () => {
  it("accepts the Melhor Envio host that matches the mode", () => {
    expect(getMelhorEnvioBaseUrlIssue("https://www.melhorenvio.com.br", production)).toBeNull();
    expect(getMelhorEnvioBaseUrlIssue("https://sandbox.melhorenvio.com.br/", staging)).toBeNull();
  });

  it("refuses to send the token anywhere else", () => {
    for (const value of [
      "http://www.melhorenvio.com.br",
      "https://melhorenvio.com.br.evil.example",
      "https://evil.example",
      "https://user:pass@www.melhorenvio.com.br",
      "not a url",
    ]) {
      expect(getMelhorEnvioBaseUrlIssue(value, production), value).not.toBeNull();
    }
  });

  it("refuses a host from the other mode", () => {
    expect(getMelhorEnvioBaseUrlIssue("https://sandbox.melhorenvio.com.br", production)).toContain("production");
    expect(getMelhorEnvioBaseUrlIssue("https://www.melhorenvio.com.br", staging)).toContain("sandbox");
  });

  it("allows a local mock only in development", () => {
    expect(getMelhorEnvioBaseUrlIssue("http://localhost:4010", development)).toBeNull();
    expect(getMelhorEnvioBaseUrlIssue("http://localhost:4010", staging)).not.toBeNull();
    expect(getMelhorEnvioBaseUrlIssue("http://127.0.0.1:4010", production)).not.toBeNull();
  });

  it("never echoes the configured value", () => {
    const issue = getMelhorEnvioBaseUrlIssue("https://token-in-host.evil.example/abc", production);
    expect(issue).not.toContain("evil");
  });
});
