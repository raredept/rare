import { describe, expect, it } from "vitest";
import { getUploadFailureDiagnostic } from "@/lib/upload-observability";

describe("upload diagnostics", () => {
  it("identifies denied provider writes without logging provider details", () => {
    const error = Object.assign(new Error("Denied https://secret-bucket.example/private.png?credential=secret"), {
      name: "AccessDenied", $metadata: { httpStatusCode: 403 }, stack: "secret stack", request: { body: "secret body" },
    });
    expect(getUploadFailureDiagnostic(error)).toEqual({errorName: "AccessDenied", code: null, httpStatus: 403, causeCategory: "provider_authorization"});
    expect(JSON.stringify(getUploadFailureDiagnostic(error))).not.toContain("secret");
  });

  it.each([
    [Object.assign(new Error("Cannot find module '@aws-crypto/example'"), {code: "MODULE_NOT_FOUND"}), "missing_dependency"],
    [new Error("Resolved credential object is not valid"), "credential_configuration"],
    [Object.assign(new TypeError("fetch failed"), {cause: Object.assign(new Error("private-host"), {code: "ENOTFOUND"})}), "provider_network"],
    [Object.assign(new Error("Rejected checksum"), {$metadata: {httpStatusCode: 400}}), "checksum_compatibility"],
    [Object.assign(new Error("Cannot replace object"), {$metadata: {httpStatusCode: 412}}), "exclusive_write_conflict"],
  ])("classifies an operational failure using fixed categories", (error, expected) => {
    expect(getUploadFailureDiagnostic(error).causeCategory).toBe(expected);
  });

  it("rejects arbitrary strings in names, codes and status fields", () => {
    expect(getUploadFailureDiagnostic({ name: "SecretTokenValue", code: "https://private.example", message: "secret", $metadata: {httpStatusCode: "403"} })).toEqual({
      errorName: "UnknownError", code: null, httpStatus: null, causeCategory: "unclassified",
    });
  });
});
