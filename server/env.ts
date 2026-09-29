// Imported first by every entrypoint so .env is loaded before other modules
// read process.env. `quiet` keeps stdout clean for the MCP stdio transport.
import dotenv from "dotenv";
dotenv.config({ quiet: true });
