import { streamText } from "ai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const result = streamText({
  model: "openai/gpt-5.6-sol",
  prompt:
    "Explain in two sentences how a transformer model processes text, then name one famous scientist.",
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}

console.log("\n\nToken usage:", await result.usage);
