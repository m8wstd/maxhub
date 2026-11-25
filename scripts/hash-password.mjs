import { randomBytes, scryptSync } from "node:crypto";

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  console.error("Run this command in an interactive terminal so the password is not echoed.");
  process.exit(1);
}

const chunks = [];
process.stdout.write("Nova senha (não será exibida): ");
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
process.stdin.resume();

process.stdin.on("data", (chunk) => {
  for (const character of chunk) {
    if (character === "\u0003") {
      process.stdout.write("\nCancelado.\n");
      process.exit(130);
    }
    if (character === "\r" || character === "\n") {
      const password = chunks.join("");
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (password.length < 12) {
        console.error("Use uma senha com pelo menos 12 caracteres.");
        process.exit(1);
      }
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      process.stdout.write(`MAXHUB_PASSWORD_HASH='scrypt\\$${salt}\\$${hash}'\n`);
      process.exit(0);
    }
    if (character === "\u007f" || character === "\b") {
      chunks.pop();
    } else if (character >= " " && chunks.length < 256) {
      chunks.push(character);
    }
  }
});
