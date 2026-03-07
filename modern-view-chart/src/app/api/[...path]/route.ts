import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function buildTargetUrl(request: NextRequest, pathSegments: string[]): URL {
  const backendOrigin = (process.env.BACKEND_ORIGIN || "http://127.0.0.1:8091").trim();
  const target = new URL(`/api/${pathSegments.join("/")}`, backendOrigin);

  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  return target;
}

function normalizePath(pathSegments: string[]): string {
  return `/${pathSegments.join("/")}`;
}

function shouldForwardAuthorization(pathname: string): boolean {
  const allowedPrefixes = [
    "/auth/revoke",
    "/auth/ws-ticket",
    "/metrics",
    "/user",
    "/ai/bridge",
  ];
  return allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldForwardCookie(pathname: string): boolean {
  const allowedPaths = new Set(["/auth/refresh", "/auth/logout"]);
  return allowedPaths.has(pathname);
}

function isSelfProxyTarget(request: NextRequest, target: URL): boolean {
  const requestProto = request.nextUrl.protocol.toLowerCase();
  const requestHost = request.nextUrl.host.toLowerCase();
  const targetProto = target.protocol.toLowerCase();
  const targetHost = target.host.toLowerCase();
  return requestProto === targetProto && requestHost === targetHost;
}

async function proxyRequest(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  const pathSegments = Array.isArray(params?.path) ? params.path : [];
  if (pathSegments.length === 0) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const targetUrl = buildTargetUrl(request, pathSegments);
  if (isSelfProxyTarget(request, targetUrl)) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid BACKEND_ORIGIN: proxy target points to this Next.js server and would create a request loop.",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
  const headers = new Headers();
  const targetPath = normalizePath(pathSegments);
  const forwardHeaderKeys = ["accept", "content-type", "x-client-id", "x-requested-with"];
  for (const key of forwardHeaderKeys) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (shouldForwardAuthorization(targetPath)) {
    const authorization = request.headers.get("authorization");
    if (authorization) headers.set("authorization", authorization);
  }
  if (shouldForwardCookie(targetPath)) {
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream proxy request failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}
