export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, method, headers, body } = req.body as {
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
    upstream.headers.forEach((value: string, key: string) => {
      responseHeaders[key] = value;
    });

    return res.status(200).json({
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      body: text,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
