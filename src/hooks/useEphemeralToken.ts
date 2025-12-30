import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_URL } from "../config";

export interface TokenDetails {
  token: string;
  expiresAt: string;
}

const fetchEphemeralToken = async (): Promise<TokenDetails> => {
  const response = await axios.post(
    `${API_URL}/api/openai/agent/ephemeral-token`
  );
  return response.data.result;
};

export const useEphemeralToken = () => {
  const {
    data: tokenDetails,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ephemeral-token"],
    queryFn: fetchEphemeralToken,
    staleTime: 0, // Always consider stale to fetch fresh token
    gcTime: 0, // Don't cache the token
    refetchOnMount: true, // Always fetch on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  return {
    token: tokenDetails?.token ?? null,
    expiresAt: tokenDetails?.expiresAt ?? null,
    isLoading,
    error,
  };
};
