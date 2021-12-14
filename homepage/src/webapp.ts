/**
 * Module dependencies.
 */
const app = require("../app");

/**
 * Listen on provided port, on all network interfaces.
 */
function startHttpServer(server: any, port: number | string) {
  console.log("Starting HTTP Server on: ", port);
  server.listen(port);
  /**
   * Event listener for http/https server "error" event.
   */
  server.on("error", function (error: any) {
    console.log("Server Error: ", error);
    if (error.syscall !== "listen") {
      throw new Error("Listen Error");
    }

    const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        process.exit(1);
        break;
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        process.exit(1);
        break;
      default: {
        throw new Error("Bind Error");
      }
    }
  });

  /**
   * Event listener for HTTP/HTTPS server "listening" event.
   */
  server.on("listening", function () {
    const addr = server.address();
    const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    console.log("Listening on " + bind);
  });
}

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string | number): number | string {
  if (typeof val === "string") {
    val = parseInt(val, 10);
    if (val < 0) {
      throw new Error("Invalid port: " + val);
    }
  }
  return val;
}

function startWebAppServers(httpPort: string | number, startHttps: boolean, httpsPort: number | string) {
  // app.set("port", port);
  httpPort = normalizePort(httpPort);
  const http = require("http");
  startHttpServer(http.createServer(app), httpPort as number);

  // Also start https server
  if (startHttps) {
    console.log("Starting https server on port: ", httpsPort);
    const https = require("https");
    if (typeof httpsPort === "string") httpsPort = normalizePort(httpsPort);
    const fs = require("fs");
    const key = fs.readFileSync("./bin/ssl/key.pem");
    const cert = fs.readFileSync("./bin/ssl/cert.pem");
    const httpsServer = https.createServer({ key: key, cert: cert }, app);
    startHttpServer(httpsServer, httpsPort);
  }
}

/**
 * Get port from environment and store in Express.
 */
startWebAppServers(process.env.PORT || "3000", process.argv[2] == "https", process.env.HTTPS_PORT || "3443");
