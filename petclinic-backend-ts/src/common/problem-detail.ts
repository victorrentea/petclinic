/**
 * RFC 7807 "Problem Details for HTTP APIs" representation.
 *
 * JSON shape:
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
 * {@code type} is set to the full request URL (rather than the default
 * "about:blank"). {@code timestamp} and {@code errors} are extension properties;
 * {@code errors} is only present for validation failures.
 */
export interface ProblemDetail {
  /** Request URL. */
  type: string;
  /** Short, human-readable summary of the problem. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail: string;
  /** ISO-8601 instant the problem was produced (extension property). */
  timestamp: string;
  /** Humanized validation messages — only present for 400 Validation Error. */
  errors?: string[];
}

/**
 * Builds a {@link ProblemDetail} from a title, detail, status and request URL.
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
