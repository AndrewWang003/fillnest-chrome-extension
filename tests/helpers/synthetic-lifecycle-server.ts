import { createServer, type Server } from "node:http";

import { renderSyntheticLifecyclePageHtml } from "../fixtures/synthetic-lifecycle-matrix";

export async function startSyntheticLifecycleServer(): Promise<{
  server: Server;
  origin: string;
}> {
  const server = createServer((request, response) => {
    const delayedHydration = new URL(request.url ?? "/", "http://fixture.local").pathname === "/delayed-hydration";
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      delayedHydration
        ? renderSyntheticLifecyclePageHtml().replace(
            "</body>",
            `<script>setTimeout(() => {
              const row = document.createElement("div");
              row.className = "field-row";
              row.innerHTML = '<label for="hydrated-address-field">Address</label><input id="hydrated-address-field" name="address" type="text" autocomplete="street-address" placeholder="Address">';
              document.querySelector("#sec-dynamic-insertion")?.append(row);
            }, 1_000);</script></body>`,
          )
        : renderSyntheticLifecyclePageHtml(),
    );
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Synthetic fixture server address unavailable");
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

export async function stopSyntheticLifecycleServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}
