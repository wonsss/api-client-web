export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { url, method, headers, body } = await req.json() as {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
    };

    const upstream = await fetch(url, {
      method,
      headers,
      body: body ?? undefined,
    });

    const text = await upstream.text();
    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return new Response(
      JSON.stringify({
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
        body: text,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
