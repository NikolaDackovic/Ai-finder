import "dotenv/config";
import axios from "axios";

const apiKey = process.env.SERPER_API_KEY?.trim();

console.log("Serper key postoji:", Boolean(apiKey));
console.log(
  "Serper key dužina:",
  apiKey ? apiKey.length : 0
);

try {
  const response = await axios.post(
    "https://google.serper.dev/search",
    {
      q: "stomatološke ordinacije Srbija",
      gl: "rs",
      hl: "sr",
      num: 5
    },
    {
      timeout: 15000,
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      }
    }
  );

  console.log("\n✅ SERPER RADI!\n");

  for (const result of response.data.organic || []) {
    console.log(
      result.title,
      "\n",
      result.link,
      "\n"
    );
  }
} catch (error) {
  console.log("\n❌ SERPER FAIL\n");

  console.log("HTTP status:", error.response?.status);
  console.log("Response:", error.response?.data);
  console.log("Message:", error.message);
}