import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const parseEventBody = (event) => {
  if (typeof event.body === "string") {
    return JSON.parse(event.body);
  }
  return event.body;
};

const retry = async (fn, maxRetries = 3, retryDelay = 1000) => {
  let retries = maxRetries;
  while (retries > 0) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes("Timedout")) {
        // Only retry on timeout errors
        console.error(
          `Retry attempt failed: ${error.message}. Retrying in ${retryDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
        retries--;
      } else {
        throw error; // Re-throw non-timeout errors
      }
    }
  }
  throw new Error("Exceeded maximum retry attempts");
};

const promptTypeOptions = {
  rsr: "reallyShortRecipe",
};

const prompts = {
  reallyShortRecipe:
    "Create a really short recipe for a dish with {ingredient1}. 5 steps or less ideally",
};

export const handler = async (event) => {
  const bodyParsed = parseEventBody(event);
  const { favoriteIngredient1, promptType } = bodyParsed;

  console.log("Lambda executed", bodyParsed);

  const promptTypeSelected = promptTypeOptions[promptType];
  const prompt = prompts[promptTypeSelected].replace(
    "{ingredient1}",
    favoriteIngredient1
  );

  try {
    const result = await retry(() => model.generateContent(prompt));
    return {
      statusCode: 200,
      body: result.response.text(),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate content " + error }),
    };
  }
};
