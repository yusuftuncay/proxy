import axios from "axios";
import { Request, Response } from "express";
import { allowedExtensions, LineTransform } from "../utils/line-transform";

export const m3u8Proxy = async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;

    if (!url) {
      return res.status(400).json("url is required");
    }

    console.log("Proxy request URL:", url);

    const isStaticFiles = allowedExtensions.some(ext => url.endsWith(ext));
    const baseUrl = url.replace(/[^/]+$/, "");

    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://megacloud.club/",
        "Origin": "https://megacloud.club"
      },
      validateStatus: () => true
    });

    console.log("Upstream status:", response.status);
    console.log("Upstream content-type:", response.headers["content-type"]);

    if (response.status >= 400) {
      return res.status(response.status).json({
        message: "Upstream rejected request",
        upstreamStatus: response.status,
        targetUrl: url
      });
    }

    const headers = { ...response.headers };

    if (!isStaticFiles) {
      delete headers["content-length"];
    }

    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Headers"] = "*";
    headers["Access-Control-Allow-Methods"] = "*";

    if (url.endsWith(".m3u8")) {
      headers["Content-Type"] = "application/x-mpegURL";
    }

    res.set(headers);

    if (isStaticFiles) {
      return response.data.pipe(res);
    }

    if (!url.endsWith(".m3u8")) {
      return response.data.pipe(res);
    }

    const transform = new LineTransform(baseUrl);
    return response.data.pipe(transform).pipe(res);
  } catch (error: any) {
    console.error("Proxy error message:", error.message);
    console.error("Proxy error code:", error.code);

    if (error.response) {
      console.error("Upstream error status:", error.response.status);
      console.error("Upstream error headers:", error.response.headers);
    }

    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      code: error.code ?? null,
      upstreamStatus: error.response?.status ?? null
    });
  }
};
