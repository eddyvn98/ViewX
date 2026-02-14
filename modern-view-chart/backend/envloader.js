import dotenv from "dotenv";
import fs from "fs";

const envPath = fs.existsSync(".env") ? ".env" : "backend/.env";
dotenv.config({ path: envPath });

console.log(`  [Config] 📂 Loaded env from: ${envPath}`);
