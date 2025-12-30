import type { FunctionTool } from "@openai/agents-realtime";

const RECIPE_API_ENDPOINT = "/api/openai/get-recipes";

interface RecipeParams {
  query: string;
}

interface RecipeResponse {
  recipes: any[];
  context: string;
  noResults?: boolean;
  error?: boolean | string;
}

const getUserId = (): string | null => {
  return localStorage.getItem("userid");
};

const fetchRecipes = async (
  query: string,
  userId: string
): Promise<RecipeResponse> => {
  try {
    const response = await fetch(`${RECIPE_API_ENDPOINT}/${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Recipe API error", response.status, errorText);
      return {
        recipes: [],
        context: "",
        noResults: true,
        error: true,
      };
    }

    return await response.json();
  } catch (err) {
    console.error("Recipe fetch failed", err);
    return {
      recipes: [],
      context: "",
      noResults: true,
      error: true,
    };
  }
};

export const getRecipesTool: FunctionTool<any, RecipeParams, RecipeResponse> = {
  name: "get-recipes",
  type: "function",
  description: "Get recipes from the database",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "User's recipe request",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: false,
  needsApproval: async () => false,
  isEnabled: async () => true,
  async invoke(_runContext, input, _details) {
    const params = typeof input === "string" ? JSON.parse(input) : input;
    const query = params.query || "";
    const userId = getUserId();

    if (!userId) {
      return {
        recipes: [],
        context: "",
        noResults: true,
        error: "User ID not found",
      };
    }

    return await fetchRecipes(query, userId);
  },
};
