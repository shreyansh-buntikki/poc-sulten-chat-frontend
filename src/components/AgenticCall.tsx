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
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Vapi from "@vapi-ai/web";

const VapiApiKey = import.meta.env.VITE_VAPI_API_KEY;
const VapiAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

const RECIPE_TOOL_ENDPOINT = "/api/vapi/get-recipes";

export const AgenticCall = () => {
  const userId = localStorage.getItem("userid");
  const { username } = useParams();
  const [callActive, setCallActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [status, setStatus] = useState("Idle");

  const [transcriptLines, setTranscriptLines] = useState<
    Array<{ role: string; text: string }>
  >([]);
  // const [recipes, setRecipes] = useState<any[]>([]);

  const vapiRef = useRef<any | null>(null);
  const isStartedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleMic = async () => {
    if (micEnabled) {
      setMicEnabled(false);
      setStatus(callActive ? "In call (mic muted)" : "Idle");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicEnabled(true);
      setStatus(
        callActive ? "In call (mic live)" : "Mic live (call not started)"
      );
    } catch (err) {
      console.error("Microphone access denied", err);
      setStatus("Microphone permission denied");
    }
  };

  async function handlePossibleInterrupt(userText: string) {
    const vapi = vapiRef.current;
    const assistantIsSpeaking =
      status.includes("speaking") || status.includes("Assistant speaking");
    if (!assistantIsSpeaking) return;

    const tryFn = async (name: string) => {
      try {
        if (vapi && typeof vapi[name] === "function") {
          await vapi[name]();
          console.log("Called vapi." + name);
          return true;
        }
      } catch (err) {
        console.warn("vapi." + name + " failed:", err);
      }
      return false;
    };

    const candidates = [
      "interrupt",
      "stopSpeech",
      "cancelResponse",
      "stopPlayback",
      "pause",
      "cancel",
    ];

    for (const name of candidates) {
      const ok = await tryFn(name);
      if (ok) break;
    }
    setStatus("Processing your interruption...");
    try {
      if (vapi && typeof vapi.sendUserMessage === "function") {
        await vapi.sendUserMessage({ text: userText });
      } else {
        console.log(
          "No sendUserMessage method; relying on streamed audio / transcript."
        );
      }
    } catch (err) {
      console.warn("Could not send user message programmatically:", err);
    }
  }

  useEffect(() => {
    const vapi = new Vapi(VapiApiKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setStatus("In call (connected)");
      setCallActive(true);
    });

    vapi.on("call-end", () => {
      setStatus("Call ended");
      setCallActive(false);
    });

    vapi.on("speech-start", () => {
      setStatus((s) => (s.includes("In call") ? "Assistant speaking..." : s));
    });
    vapi.on("speech-end", () => {
      setStatus((s) =>
        s.includes("Assistant speaking") ? "In call (connected)" : s
      );
    });

    vapi.on("message", async (message: any) => {
      try {
        if (message?.type === "transcript") {
          const role = message.role ?? "user";
          const text = message.transcript ?? message.text ?? "";
          if (role === "user" && status.toLowerCase().includes("speaking")) {
            handlePossibleInterrupt(text);
          }
          setTranscriptLines((p) => [...p, { role, text }]);
          return;
        }

        if (
          message?.type === "assistant_response" ||
          (message?.role === "assistant" && message?.type === "text")
        ) {
          const text = message.text ?? message.transcript ?? "";
          setTranscriptLines((p) => [...p, { role: "assistant", text }]);
          return;
        }

        const isToolCall =
          message?.type === "tool_call" ||
          message?.type === "tool.call" ||
          message?.type === "tool" ||
          message?.type === "function_call" ||
          Boolean(message?.tool) ||
          Boolean(message?.name === "tool.call");

        if (isToolCall) {
          const toolCall = message;
          console.log("Vapi tool-call received", toolCall);

          const inputQuery =
            toolCall?.arguments?.query ??
            toolCall?.input?.query ??
            toolCall?.payload?.query ??
            toolCall?.query ??
            "";

          setStatus("Searching recipes...");

          let json: any = null;
          try {
            const resp = await fetch(`${RECIPE_TOOL_ENDPOINT}/${userId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: inputQuery }),
            });

            if (!resp.ok) {
              const txt = await resp.text();
              console.error("Recipe tool error", resp.status, txt);
              json = { recipes: [], context: "", noResults: true, error: true };
            } else {
              json = await resp.json();
            }
          } catch (err) {
            console.error("Recipe fetch failed", err);
            json = { recipes: [], context: "", noResults: true, error: true };
          }

          // setRecipes(json.recipes ?? []);

          const vapi = vapiRef.current;
          if (vapi) {
            if (typeof vapi.sendToolResult === "function") {
              try {
                await vapi.sendToolResult(
                  toolCall.id ?? toolCall.callId ?? toolCall.tool_call_id,
                  json
                );
              } catch (err) {
                console.warn(
                  "sendToolResult failed, trying respondToolCall",
                  err
                );
                if (typeof vapi.respondToolCall === "function") {
                  await vapi.respondToolCall(
                    toolCall.id ?? toolCall.callId ?? toolCall.tool_call_id,
                    json
                  );
                } else if (typeof vapi.completeToolCall === "function") {
                  await vapi.completeToolCall(
                    toolCall.id ?? toolCall.callId ?? toolCall.tool_call_id,
                    json
                  );
                } else {
                  console.warn(
                    "No known method to return tool result to Vapi SDK. Please check SDK docs."
                  );
                }
              }
            } else if (typeof vapi.respondToolCall === "function") {
              await vapi.respondToolCall(
                toolCall.id ?? toolCall.callId ?? toolCall.tool_call_id,
                json
              );
            } else if (typeof vapi.completeToolCall === "function") {
              await vapi.completeToolCall(
                toolCall.id ?? toolCall.callId ?? toolCall.tool_call_id,
                json
              );
            } else {
              console.warn(
                "Vapi SDK missing tool result method. The assistant may not receive the tool output automatically."
              );
            }
          }

          setStatus("Showing suggestions");
        }
      } catch (err) {
        console.error("Error handling vapi message", err);
      }
    });

    vapi.on("error", (err: any) => {
      console.error("Vapi error:", err);
      setStatus("Vapi error");
    });

    return () => {
      try {
        vapi.stop();
      } catch {}
      vapiRef.current = null;
    };
  }, []);

  const startCall = () => {
    if (!vapiRef.current) {
      setStatus("SDK not initialized");
      return;
    }
    if (!micEnabled) {
      setStatus("Enable mic first");
      return;
    }
    try {
      vapiRef.current.start(VapiAssistantId);
      isStartedRef.current = true;
      setStatus("Starting call...");
    } catch (err) {
      console.error("Failed to start call", err);
      setStatus("Failed to start call");
    }
  };

  const endCall = () => {
    if (!vapiRef.current) return;
    try {
      vapiRef.current.stop();
      isStartedRef.current = false;
      setStatus("Call stopped");
    } catch (err) {
      console.error("Failed to stop", err);
      setStatus("Failed to stop call");
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines]);

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
                Agentic Call
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
