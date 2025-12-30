import CallIcon from "@mui/icons-material/Call";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { useEphemeralToken } from "../hooks/useEphemeralToken";
import { useRecipesToolMutation } from "../hooks/useRecipesTool";
import { useOpenAIRealtimeCall } from "../hooks/useOpenAIRealtimeCall";

export const OpenaiCall = () => {
  const { username } = useParams();
  const {
    token,
    isLoading: tokenLoading,
    error: tokenError,
  } = useEphemeralToken();
  const recipesTool = useRecipesToolMutation();

  const {
    callActive,
    micEnabled,
    status,
    transcriptLines,
    toggleMic,
    startCall,
    endCall,
    messagesEndRef,
  } = useOpenAIRealtimeCall({
    token,
    onGetRecipes: async (query: string) => {
      console.log("🎯 [OpenaiCall] onGetRecipes called with query:", query);

      const userId = localStorage.getItem("userid");
      console.log("🎯 [OpenaiCall] UserId from localStorage:", userId);

      if (!userId) {
        console.error("❌ [OpenaiCall] User ID not found in localStorage");
        return {
          recipes: [],
          context: "",
          noResults: true,
          error: "User ID not found",
        };
      }

      try {
        console.log("🎯 [OpenaiCall] Calling recipesTool.mutateAsync...");
        console.log("🎯 [OpenaiCall] Mutation state:", {
          isPending: recipesTool.isPending,
          isError: recipesTool.isError,
          error: recipesTool.error,
        });

        const result = await recipesTool.mutateAsync({ userId, query });

        console.log("✅ [OpenaiCall] Mutation successful, result:", result);
        return result;
      } catch (error) {
        console.error("❌ [OpenaiCall] Mutation failed:", error);
        console.error("❌ [OpenaiCall] Error details:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    },
  });

  if (tokenLoading) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ p: 3 }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading token...
        </Typography>
      </Stack>
    );
  }

  if (tokenError) {
    return (
      <Stack sx={{ p: 3 }}>
        <Alert severity="error">Failed to load token. Please try again.</Alert>
      </Stack>
    );
  }

  if (!token) {
    return (
      <Stack sx={{ p: 3 }}>
        <Alert severity="warning">No token available.</Alert>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: 480,
          maxWidth: "100%",
          p: 3,
          borderRadius: 2,
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography variant="h6" fontWeight={600}>
                OpenAI Agentic Call
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {username ? `User: ${username}` : "Ready to connect"}
              </Typography>
            </Box>
            <Chip
              label={callActive ? "LIVE" : "IDLE"}
              color={callActive ? "success" : "default"}
              size="small"
            />
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "#fafafa",
              display: "flex",
              flexDirection: "column",
              height: 300,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
              Status: {status}
            </Typography>

            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                pr: 1,
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "#f1f1f1",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#888",
                  borderRadius: "3px",
                  "&:hover": {
                    background: "#555",
                  },
                },
              }}
            >
              <Stack spacing={1}>
                {transcriptLines.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 2 }}
                  >
                    No messages yet
                  </Typography>
                ) : (
                  transcriptLines.map((t, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: "flex",
                        justifyContent:
                          t.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <Paper
                        elevation={0}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          maxWidth: "75%",
                          bgcolor:
                            t.role === "user" ? "primary.main" : "grey.200",
                          color: t.role === "user" ? "white" : "text.primary",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.8, display: "block", mb: 0.5 }}
                        >
                          {t.role === "user" ? "You" : "Assistant"}
                        </Typography>
                        <Typography variant="body2">{t.text}</Typography>
                      </Paper>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Stack>
            </Box>
          </Paper>

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              startIcon={<CallIcon />}
              onClick={startCall}
              disabled={callActive || !micEnabled}
              fullWidth
            >
              {callActive ? "Call in progress" : "Start Call"}
            </Button>

            <IconButton
              onClick={toggleMic}
              color={micEnabled ? "primary" : "default"}
              sx={{
                border: "2px solid",
                borderColor: micEnabled ? "primary.main" : "divider",
              }}
            >
              {micEnabled ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </Stack>

          {callActive && (
            <Button
              variant="outlined"
              color="error"
              onClick={endCall}
              fullWidth
            >
              End Call
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};
