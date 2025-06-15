/* Copyright (C) 2025 Esteban Torre */

import * as crypto from "node:crypto";
import * as bs58 from "npm:bs58@6.0.0";
import { serveDir, serveFile } from "jsr:@std/http/file-server"


function hmacB58(data: string, secret: string = "verySecret") : string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  return bs58.default.encode(hmac.digest());
}


function handler(req: Request) {

  const path = new URL(req.url).pathname;

  if (path == "/ws") {
    if (req.headers.get("upgrade") != "websocket") {
      return new Response(null, { status: 501 });
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.addEventListener("open", () => {

    });
    socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        if (data.c == "register") {
          socket.send(
            `{"c":"public_id","d":"${hmacB58(data.i).substring(5, 13)}"}`
          );
        } else if (data.c == "ping") {
          socket.send(`{"c":"pong"}`);
        }
    });
    socket.addEventListener("close", (_event) => {

    });
    return response;
  }

  return serveFile(req, "public/index.html");
}

Deno.serve(handler);
