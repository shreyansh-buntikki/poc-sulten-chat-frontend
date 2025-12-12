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
  Fade,
  Grow,
  Zoom,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Vapi from "@vapi-ai/web";
import { keyframes } from "@mui/system";

const VapiApiKey = import.meta.env.VITE_VAPI_API_KEY;
const VapiAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

const RECIPE_TOOL_ENDPOINT = "/api/vapi/get-recipes";

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
`;

// const wave = keyframes`
//   0%, 100% { transform: translateY(0); }
//   50% { transform: translateY(-8px); }
// `;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(33, 150, 243, 0.3); }
  50% { box-shadow: 0 0 40px rgba(33, 150, 243, 0.6); }
`;

const slideUp = keyframes`
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

export const AgenticCall = () => {
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
            const resp = await fetch(RECIPE_TOOL_ENDPOINT, {
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

  const isSpeaking = status.includes("speaking") || status.includes("Assistant speaking");

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
      <Fade in timeout={800}>
        <Paper
          elevation={24}
          sx={{
            width: 480,
            maxWidth: "100%",
            p: 4,
            borderRadius: 4,
            background: "linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)",
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
            },
          }}
        >
          <Stack spacing={3}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{
                    background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Agentic Call
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {username ? `Connected as ${username}` : "Ready to connect"}
                </Typography>
              </Box>
              <Zoom in timeout={500}>
                <Chip
                  label={callActive ? "● LIVE" : "IDLE"}
                  color={callActive ? "success" : "default"}
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    animation: callActive ? `${pulse} 2s ease-in-out infinite` : "none",
                  }}
                />
              </Zoom>
            </Stack>

            <Grow in timeout={600}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                    animation: isSpeaking ? `${shimmer} 2s infinite` : "none",
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                >
                  Status
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{
                    mt: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  {isSpeaking && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "#4caf50",
                        animation: `${pulse} 1s ease-in-out infinite`,
                      }}
                    />
                  )}
                  {status}
                </Typography>

                <Box sx={{ mt: 2, maxHeight: 200, overflowY: "auto" }}>
                  {transcriptLines.slice(-6).map((t, i) => (
                    <Fade in key={i} timeout={400}>
                      <Box
                        sx={{
                          mb: 1.5,
                          display: "flex",
                          justifyContent: t.role === "user" ? "flex-end" : "flex-start",
                          animation: `${slideUp} 0.4s ease-out`,
                        }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            px: 2,
                            py: 1,
                            borderRadius: 2,
                            maxWidth: "80%",
                            background:
                              t.role === "user"
                                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                : "#ffffff",
                            color: t.role === "user" ? "#ffffff" : "#000000",
                          }}
                        >
                          <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.8 }}>
                            {t.role === "user" ? "You" : "Assistant"}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {t.text}
                          </Typography>
                        </Paper>
                      </Box>
                    </Fade>
                  ))}
                </Box>
              </Paper>
            </Grow>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                startIcon={<CallIcon />}
                onClick={startCall}
                disabled={callActive}
                fullWidth
                sx={{
                  py: 1.5,
                  borderRadius: 3,
                  fontWeight: 700,
                  fontSize: "1rem",
                  background: callActive
                    ? "#e0e0e0"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: callActive ? "none" : "0 8px 24px rgba(102, 126, 234, 0.4)",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: callActive ? "none" : "translateY(-2px)",
                    boxShadow: callActive ? "none" : "0 12px 32px rgba(102, 126, 234, 0.5)",
                  },
                }}
              >
                {callActive ? "Call in progress" : "Start Call"}
              </Button>

              <IconButton
                onClick={toggleMic}
                sx={{
                  width: 56,
                  height: 56,
                  border: "3px solid",
                  borderColor: micEnabled ? "#667eea" : "#e0e0e0",
                  background: micEnabled
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "#ffffff",
                  color: micEnabled ? "#ffffff" : "#9e9e9e",
                  transition: "all 0.3s ease",
                  animation: micEnabled && callActive ? `${glow} 2s infinite` : "none",
                  "&:hover": {
                    transform: "scale(1.1)",
                    borderColor: micEnabled ? "#764ba2" : "#bdbdbd",
                  },
                }}
              >
                {micEnabled ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Stack>

            {callActive && (
              <Zoom in timeout={400}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={endCall}
                  fullWidth
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    borderWidth: 2,
                    "&:hover": {
                      borderWidth: 2,
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  End Call
                </Button>
              </Zoom>
            )}
          </Stack>
        </Paper>
      </Fade>
    </Box>
  );
};