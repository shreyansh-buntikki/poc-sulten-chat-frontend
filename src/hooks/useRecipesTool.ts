import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { API_URL } from "../config";

const RECIPE_TOOL_ENDPOINT = "/api/openai/get-recipes";

interface RecipesToolInput {
  userId: string;
  query: string;
}

export interface RecipesToolResult {
  recipes: any[];
  context: string;
  noResults?: boolean;
  error?: boolean | string;
}

const fetchRecipes = async ({
  userId,
  query,
}: RecipesToolInput): Promise<RecipesToolResult> => {
  console.log("🌐 [API] Starting recipe fetch...");
  console.log("🌐 [API] Endpoint:", `${RECIPE_TOOL_ENDPOINT}/${userId}`);
  console.log("🌐 [API] Query:", query);
  console.log("🌐 [API] UserId:", userId);

  try {
    const resp = await axios.post(
      `${API_URL}${RECIPE_TOOL_ENDPOINT}/${userId}`,
      { query },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return resp.data;
  } catch (error: any) {
    console.log(error);

    throw error;
  }
};

export const useRecipesToolMutation = () => {
  return useMutation<RecipesToolResult, Error, RecipesToolInput>({
    mutationFn: fetchRecipes,
  });
};
