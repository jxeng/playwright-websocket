import { WebSocketServer } from "ws";
import { chromium } from "playwright";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data) {
    ws.send("received: " + data);
  });
});

const run = async function () {
  const browser = await chromium.launch({
    headless: false,
    devtools: true,
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();
  await new Promise((r) => setTimeout(r, 1000));
  page.goto("http://localhost:8003");

  // Record message from websocket
  // can also use CDP to implement
  // https://chromedevtools.github.io/devtools-protocol/tot/Network/
  // Network.webSocketFrameReceived and Network.webSocketFrameSent
  page.on("websocket", (ws) => {
    console.log(`webSocket opened: ${ws.url()}`);
    ws.on("framesent", ({ payload }) => console.log("framesent:", payload));
    ws.on("framereceived", ({ payload }) =>
      console.log("framereceived:", payload)
    );
    ws.on("close", () => console.log("WebSocket closed"));
  });

  // sent message over CDP
  // https://chromedevtools.github.io/devtools-protocol/tot/Runtime/
  const client = await page.context().newCDPSession(page);
  await client.send("Runtime.enable");
  const { result } = await client.send("Runtime.evaluate", {
    expression: "WebSocket.prototype",
  });
  console.log(result);
  const { objects } = await client.send("Runtime.queryObjects", {
    prototypeObjectId: result.objectId,
  });
  console.log(objects);
  await client.send("Runtime.callFunctionOn", {
    objectId: objects.objectId,
    functionDeclaration: `function () {
				const ws = this[0];
				setTimeout(() => {
					ws.send("I'm from playwright CDP.");
				}, 500)
		}`,
  });
};

run();
