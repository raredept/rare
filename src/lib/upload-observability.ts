const diagnosticNames = new Set([
  "Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "TimeoutError", "AbortError",
  "AccessDenied", "Forbidden", "InvalidAccessKeyId", "SignatureDoesNotMatch", "CredentialsProviderError",
  "NoSuchBucket", "NotFound", "InvalidRequest", "InvalidArgument", "NotImplemented", "ServiceUnavailable",
  "InternalError", "NetworkingError", "PreconditionFailed", "InvalidChecksum", "BadDigest", "RequestTimeout",
]);

const diagnosticCodes = new Set([
  "MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND", "ERR_INVALID_URL", "ERR_INVALID_ARG_TYPE", "ERR_INVALID_ARG_VALUE",
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENETUNREACH", "EHOSTUNREACH",
  "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID",
  "AccessDenied", "Forbidden", "InvalidAccessKeyId", "SignatureDoesNotMatch", "NoSuchBucket", "PreconditionFailed",
  "InvalidChecksum", "BadDigest", "RequestTimeout", "NotImplemented",
]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

// Only fixed vocabulary and an HTTP status leave this helper. Provider messages can
// contain bucket URLs, object keys or credentials and must never enter upload logs.
export function getUploadFailureDiagnostic(error: unknown) {
  const root = record(error);
  const cause = record(root.cause);
  const name = string(root.name);
  const code = [string(root.code), string(cause.code)].find((value) => diagnosticCodes.has(value)) ?? null;
  const status = record(root.$metadata).httpStatusCode;
  const httpStatus = typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
  const classification = [name, code, string(root.message), string(cause.name), string(cause.message)].join(" ");
  let causeCategory = "unclassified";

  if (/MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Cannot find (?:module|package)/i.test(classification)) {
    causeCategory = "missing_dependency";
  } else if (httpStatus === 401 || httpStatus === 403 || /AccessDenied|Forbidden/i.test(classification)) {
    causeCategory = "provider_authorization";
  } else if (/Upload Cloudflare R2 incompleto|credential|InvalidAccessKeyId|SignatureDoesNotMatch/i.test(classification)) {
    causeCategory = "credential_configuration";
  } else if (/NoSuchBucket/i.test(classification)) {
    causeCategory = "bucket_configuration";
  } else if (/ERR_INVALID_URL|Invalid endpoint/i.test(classification)) {
    causeCategory = "endpoint_configuration";
  } else if (/checksum|BadDigest|crc32|crc64/i.test(classification)) {
    causeCategory = "checksum_compatibility";
  } else if (/ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|EPIPE|ENETUNREACH|EHOSTUNREACH|TimeoutError|RequestTimeout|CERT_|TLS_|fetch failed/i.test(classification)) {
    causeCategory = "provider_network";
  } else if (httpStatus === 412 || /PreconditionFailed/i.test(classification)) {
    causeCategory = "exclusive_write_conflict";
  } else if (httpStatus === 501 || /NotImplemented/i.test(classification)) {
    causeCategory = "provider_unsupported_operation";
  } else if (httpStatus !== null) {
    causeCategory = "provider_response";
  }

  return { errorName: diagnosticNames.has(name) ? name : "UnknownError", code, httpStatus, causeCategory };
}
