/**
 * RFC 7807 "Problem Details for HTTP APIs" representation.
 *
 * Mirrors the JSON shape produced by Spring's {@code org.springframework.http.ProblemDetail}
 * as used by {@code ExceptionControllerAdvice}:
 *
 *   {
 *     "type": "<request URL>",
 *     "title": "Validation Error",
 *     "status": 400,
 *     "detail": "Validation failed for request. See 'errors' for details.",
 *     "timestamp": "2026-05-29T12:34:56.789Z",
 *     "errors": [ "Birth date must not be in the future (value: 3000-01-01)" ]
 *   }
 *
 * In Spring, {@code pd.setType(request.getRequestURL())} overwrites the default
 * "about:blank" with the request URL, so {@code type} here is the full request URL.
 * {@code timestamp} and {@code errors} are Spring "extension" properties (set via
 * {@code pd.setProperty(...)}); {@code errors} is only present for validation failures.
 */
export interface ProblemDetail {
  /** Request URL (Spring sets {@code pd.setType(request.getRequestURL())}). */
  type: string;
  /** Short, human-readable summary of the problem. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail: string;
  /** ISO-8601 instant the problem was produced (Spring extension property). */
  timestamp: string;
  /** Humanized validation messages — only present for 400 Validation Error. */
  errors?: string[];
}

/**
 * Builds a {@link ProblemDetail}, mirroring
 * {@code ExceptionControllerAdvice.buildProblemDetail(...)}.
 */
export function buildProblemDetail(
  title: string,
  detail: string,
  status: number,
  requestUrl: string,
): ProblemDetail {
  return {
    type: requestUrl,
    title,
    status,
    detail,
    timestamp: new Date().toISOString(),
  };
}
