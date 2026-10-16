const BASE = "/api";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type JsonBody = unknown;

async function request<T>(
  method: string,
  path: string,
  body?: JsonBody,
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers:
      body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      response.status,
      errorBody,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiGet = <T>(path: string) =>
  request<T>("GET", path);

export const apiPost = <T>(
  path: string,
  body?: JsonBody,
) => request<T>("POST", path, body ?? null);

export const apiPut = <T>(
  path: string,
  body?: JsonBody,
) => request<T>("PUT", path, body ?? null);

export const apiPatch = <T>(
  path: string,
  body?: JsonBody,
) => request<T>("PATCH", path, body ?? null);

export const apiDelete = <T>(path: string) =>
  request<T>("DELETE", path);
