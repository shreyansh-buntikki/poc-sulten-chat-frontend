import { useEffect, useRef, useState } from "react";
import axios from "axios";

const OPENAI_REALTIME_ENDPOINT =
  "https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17";

export interface TranscriptLine {
  role: string;
  text: string;
}

interface UseOpenAIRealtimeCallOptions {
  token: string | null;
  onGetRecipes: (query: string) => Promise<any>;
}

interface UseOpenAIRealtimeCallResult {
  callActive: boolean;
  micEnabled: boolean;
  status: string;
  transcriptLines: TranscriptLine[];
  toggleMic: () => Promise<void>;
  startCall: () => Promise<void>;
  endCall: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const useOpenAIRealtimeCall = (
  options: UseOpenAIRealtimeCallOptions
): UseOpenAIRealtimeCallResult => {
  const { token, onGetRecipes } = options;

  const [callActive, setCallActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const addTranscriptMessage = (
    role: string,
    text: string,
    transcriptType?: string
  ) => {
    setTranscriptLines((prev) => {
      if (prev.length === 0) {
        return [{ role, text }];
      }
      const lastLine = prev[prev.length - 1];
      const isPartial = transcriptType === "partial";

      if (lastLine.role === role) {
        if (isPartial) {
          return [...prev.slice(0, -1), { role, text }];
        } else {
          const lastText = lastLine.text.trim();
          const newText = text.trim();

          if (lastText === newText || newText.startsWith(lastText)) {
            return [...prev.slice(0, -1), { role, text: newText }];
          } else {
            return [
              ...prev.slice(0, -1),
              { role, text: lastText + " " + newText },
            ];
          }
        }
      }
      return [...prev, { role, text }];
    });
  };

  const handleDataChannelMessage = async (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Log ALL events for debugging
      if (data.type.includes('function') || data.type.includes('tool')) {
        console.log("🔔 [Function Event]:", data.type, JSON.stringify(data, null, 2));
      }
  
      // Handle user transcript
      if (data.type === "conversation.item.input_audio_transcription.completed") {
        const text = data.transcript || "";
        if (text) {
          console.log("📝 [Transcript] User:", text);
          addTranscriptMessage("user", text);
        }
      }
  
      // Handle assistant response
      if (data.type === "response.done") {
        console.log("✅ [Response] Done");
        setStatus("In call (connected)");
      }
  
      // Assistant audio transcript (partial)
      if (data.type === "response.audio_transcript.delta") {
        const text = data.delta || "";
        if (text) {
          addTranscriptMessage("assistant", text, "partial");
        }
      }
  
      // Assistant audio transcript (final)
      if (data.type === "response.audio_transcript.done") {
        const text = data.transcript || "";
        if (text) {
          console.log("📝 [Transcript] Assistant:", text);
          addTranscriptMessage("assistant", text);
        }
      }
  
      // ✅ UPDATED: Handle function call creation
      if (data.type === "response.output_item.added") {
        if (data.item?.type === "function_call") {
          console.log("🔧 [Function Call] Output item added:", JSON.stringify(data, null, 2));
        }
      }
  
      // ✅ Handle function call arguments (streaming)
      if (data.type === "response.function_call_arguments.delta") {
        console.log("🔧 [Function Call] Arguments delta:", data.delta);
      }
  
      // ✅ Handle function call arguments done
      if (data.type === "response.function_call_arguments.done") {
        console.log("🔧 [Function Call] Arguments DONE event");
        console.log("🔧 [Function Call] Full data:", JSON.stringify(data, null, 2));
  
        const functionName = data.name;
        const callId = data.call_id;
        const argumentsStr = data.arguments;
  
        console.log("🔧 [Function Call] Name:", functionName);
        console.log("🔧 [Function Call] Call ID:", callId);
        console.log("🔧 [Function Call] Arguments:", argumentsStr);
  
        if (functionName === "get-recipes") {
          console.log("🍳 [Recipe Tool] Starting recipe search...");
          setStatus("Searching recipes...");
        
          let query = "";
          try {
            if (argumentsStr) {
              const args = JSON.parse(argumentsStr);
              query = args.query || "";
              console.log("🍳 [Recipe Tool] Parsed query:", query);
            }
          } catch (err) {
            console.error("🍳 [Recipe Tool] Failed to parse arguments:", err);
          }
        
          if (!query) {
            console.error("🍳 [Recipe Tool] Query is empty");
            setStatus("Error: No query provided");
            return;
          }
        
          let formattedResult: any = null;
          try {
            console.log("🍳 [Recipe Tool] Calling onGetRecipes...");
            const result = await onGetRecipes(query);
            console.log("🍳 [Recipe Tool] Raw result from backend:", JSON.stringify(result, null, 2));
            
            // ✅ CRITICAL FIX: Use correct field names from your backend
            formattedResult = {
              count: result.recipes?.length || 0,
              recipes: result.recipes?.map((recipe: any) => {
                console.log("🍳 [Recipe Tool] Processing recipe:", recipe);
                return {
                  name: recipe.recipe_name || recipe.name,  // Your backend returns recipe_name
                  description: recipe.ingress || recipe.description || "",  // Your backend returns ingress
                };
              }) || [],
            };
            
            console.log("🍳 [Recipe Tool] Formatted result to send:", JSON.stringify(formattedResult, null, 2));
          } catch (err) {
            console.error("🍳 [Recipe Tool] Error:", err);
            formattedResult = {
              count: 0,
              recipes: [],
              error: "Failed to fetch recipes",
            };
          }
        
          // Send function output back
          if (dataChannelRef.current?.readyState === "open") {
            console.log("🍳 [Recipe Tool] Sending output to OpenAI...");
        
            const functionCallOutput = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify(formattedResult),
              },
            };
        
            console.log("📤 [Recipe Tool] EXACT payload being sent:", JSON.stringify(functionCallOutput, null, 2));
            
            dataChannelRef.current.send(JSON.stringify(functionCallOutput));
            console.log("✅ [Recipe Tool] Output sent successfully");
        
            // Trigger response
            dataChannelRef.current.send(JSON.stringify({ type: "response.create" }));
            console.log("✅ [Recipe Tool] Response.create sent");
            
            setStatus("In call");
          } else {
            console.error("❌ [Recipe Tool] Data channel not open, state:", dataChannelRef.current?.readyState);
          }
        }
        
      }
  
      // ✅ NEW: Handle response.output_item.done (alternative event)
      if (data.type === "response.output_item.done") {
        if (data.item?.type === "function_call") {
          console.log("🔧 [Function Call] Output item done:", JSON.stringify(data.item, null, 2));
        }
      }
  
      // Session updates
      if (data.type === "session.updated") {
        console.log("✅ [Session] Updated:", JSON.stringify(data.session, null, 2));
        if (data.session?.status === "connected") {
          setStatus("In call (connected)");
          setCallActive(true);
        }
      }
  
      // Session created
      if (data.type === "session.created") {
        console.log("✅ [Session] Created");
      }
  
      // Errors
      if (data.type === "error") {
        console.error("❌ [Error] OpenAI error:", JSON.stringify(data, null, 2));
        setStatus(`Error: ${data.error?.message || "Unknown error"}`);
      }
    } catch (err) {
      console.error("❌ [Error] Message handler error:", err);
    }
  };
  

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }

    setCallActive(false);
    setMicEnabled(false);
  };

  const initializeWebRTC = async () => {
    if (!token) {
      setStatus("Token not available");
      return;
    }

    try {
      setStatus("Initializing connection...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        } else {
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.autoplay = true;
          audioRef.current = audio;
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected") {
          setStatus("Connected");
        } else if (pc.iceConnectionState === "disconnected") {
          setStatus("Disconnected");
          setCallActive(false);
        } else if (pc.iceConnectionState === "failed") {
          setStatus("Connection failed");
          setCallActive(false);
        }
      };

      const dataChannel = pc.createDataChannel("oai-events", {
        ordered: true,
      });
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log("✅ [DataChannel] Opened");
        setStatus("Data channel ready");
      
        const sessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions:
              "You are Sulten, a cooking assistant with access to a recipe database. CRITICAL RULE: You do NOT have recipe information in your training data. Whenever users ask about recipes, dishes, meals, or cooking ideas, you MUST call the get-recipes tool FIRST before responding. Never suggest recipes from your own knowledge. After calling get-recipes and receiving results, present them to the user naturally. If asked about non-cooking topics, politely decline. Be friendly and conversational.",
            voice: "ash",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            tool_choice: "auto",
            tools: [
              {
                type: "function",
                name: "get-recipes",
                description:
                  "Searches the recipe database for recipes. Call this tool for ANY recipe-related question including: specific dishes (pasta, chicken), occasions (Christmas, Halloween), dietary needs (vegetarian, vegan), cooking time, difficulty, cuisine type, or general meal ideas. Always call this before suggesting recipes.",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description:
                        "The user's recipe search request. Examples: 'Christmas recipes', 'easy pasta dishes', 'vegetarian dinner ideas', 'quick meals', 'Italian cuisine'",
                    },
                  },
                  required: ["query"],
                },
              },
            ],
          },
        };
      
        console.log("📤 [DataChannel] Sending session update");
        dataChannel.send(JSON.stringify(sessionUpdate));
      };
      

      dataChannel.onmessage = handleDataChannelMessage;

      dataChannel.onerror = (error) => {
        console.error("Data channel error:", error);
        setStatus("Data channel error");
      };

      dataChannel.onclose = () => {
        console.log("Data channel closed");
        setStatus("Data channel closed");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await axios.post(OPENAI_REALTIME_ENDPOINT, offer.sdp, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
        responseType: "text",
      });

      const answerSdp = response.data;
      const answer = new RTCSessionDescription({
        type: "answer",
        sdp: answerSdp,
      });

      await pc.setRemoteDescription(answer);

      setStatus("In call (connected)");
      setCallActive(true);
    } catch (err) {
      console.error("Failed to initialize WebRTC:", err);
      setStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      cleanup();
    }
  };

  const toggleMic = async () => {
    if (micEnabled) {
      setMicEnabled(false);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setStatus(callActive ? "In call (mic muted)" : "Idle");
      return;
    }

    try {
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;

        if (pcRef.current) {
          stream.getTracks().forEach((track) => {
            pcRef.current!.addTrack(track, stream);
          });
        }
      } else {
        localStreamRef.current.getTracks().forEach((track) => {
          track.enabled = true;
        });
      }

      setMicEnabled(true);
      setStatus(
        callActive ? "In call (mic live)" : "Mic live (call not started)"
      );
    } catch (err) {
      console.error("Microphone access denied", err);
      setStatus("Microphone permission denied");
    }
  };

  const startCall = async () => {
    if (!token) {
      setStatus("Token not available");
      return;
    }
    if (!micEnabled) {
      setStatus("Enable mic first");
      return;
    }
    await initializeWebRTC();
  };

  const endCall = () => {
    cleanup();
    setStatus("Call stopped");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    callActive,
    micEnabled,
    status,
    transcriptLines,
    toggleMic,
    startCall,
    endCall,
    messagesEndRef: messagesEndRef as React.RefObject<HTMLDivElement>,
  };
};
