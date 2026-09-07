import { unstable_isUnrecognizedActionError } from "next/navigation";

export function shouldOfferServerActionRefresh(
  error: unknown,
  isUnrecognizedActionError: (candidate: unknown) => boolean = unstable_isUnrecognizedActionError,
) {
  return isUnrecognizedActionError(error);
}
