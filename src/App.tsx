import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import "./App.css";
import { SearchUser } from "./components/SearchUser";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import "react-toastify/dist/ReactToastify.css";
import { toast, ToastContainer } from "react-toastify";
import { Route, Routes, useParams } from "react-router-dom";
import axios from "axios";
import { API_URL } from "./config";

interface Message {
  text: string;
  timestamp: Date;
  aiResponse?: boolean;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
  },
});

function App() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <Stack
          direction="column"
          gap={2}
          sx={{
            height: "100dvh",
            overflow: "hidden",
          }}
        >
          <Typography
            variant="h2"
            textAlign="center"
            color="primary"
            fontWeight="bold"
            sx={{
              fontStyle: "italic",
              flexShrink: 0,
            }}
          >
            Chatbot Playground
          </Typography>
          <ToastContainer position="top-center" />
          <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <Routes>
              <Route path="/" element={<SearchUser />} />
              <Route path="/:username" element={<ChatContainer />} />
            </Routes>
          </Box>
        </Stack>
      </QueryClientProvider>
    </>
  );
}

const ChatContainer = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const { username } = useParams();

  const askAiMutation = useMutation({
    mutationFn: (text: string) =>
      axios.post(`${API_URL}/api/ollama/${username}/chat`, {
        message: text,
      }),
    onSuccess: (res) => {
      const message = res.data.response;
      setMessages([...messages, { text: message, timestamp: new Date() }]);
    },
    onError: () => {
      toast.error("Something went wrong...");
    },
  });

  const handleSendMessage = useCallback(() => {
    if (message.trim()) {
      console.log("Sending message...", message);
      askAiMutation.mutate(message);
      setMessages([
        ...messages,
        { text: message, timestamp: new Date(), aiResponse: true },
      ]);
      setMessage("");
    }
  }, [message, messages, askAiMutation]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Stack
      direction="row"
      gap={2}
      sx={{
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Chat Container */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          bgcolor: "#f5f5f5",
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {messages.map((msg, index) => (
            <Paper
              key={index}
              elevation={1}
              sx={{
                padding: 2,
                maxWidth: "70%",
                alignSelf: msg.aiResponse ? "flex-end" : "flex-start",
                bgcolor: msg.aiResponse ? "#1976d2" : "#000",
                color: "white",
                borderRadius: 2,
                flexShrink: 0,
              }}
            >
              <Box>{msg.text}</Box>
              <Box
                sx={{
                  fontSize: "0.75rem",
                  opacity: 0.8,
                  marginTop: 0.5,
                }}
              >
                {msg.timestamp.toLocaleTimeString()}
              </Box>
            </Paper>
          ))}
          {askAiMutation.isPending && (
            <Paper
              elevation={1}
              sx={{
                padding: 2,
                maxWidth: "70%",
                alignSelf: "flex-start",
                bgcolor: "#000",
                color: "white",
                borderRadius: 2,
                flexShrink: 0,
              }}
            >
              <Box className="typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </Box>
            </Paper>
          )}
        </Box>

        <Box
          sx={{
            padding: 2,
            width: "100%",
            flexShrink: 0,
          }}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <TextField
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              fullWidth
              multiline
              maxRows={4}
              variant="outlined"
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!message.trim()}
              sx={{
                bgcolor: "#1976d2",
                color: "white",
                "&:hover": {
                  bgcolor: "#1565c0",
                },
                "&:disabled": {
                  bgcolor: "#e0e0e0",
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </Stack>
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          padding: 2,
          bgcolor: "white",
          overflowY: "auto",
        }}
      >
        <UserResponse />
      </Box>
    </Stack>
  );
};

const UserResponse = () => {
  const { username } = useParams();
  const { data: user, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: () => axios.get(`${API_URL}/api/user/${username}`),
  });

  const generateEmbeddings = useMutation({
    mutationFn: () =>
      axios.post(`${API_URL}/api/user/${username}/ollama/generate-embeddings`),
    onError: () => {
      toast.error("Something went wrong...");
    },
    onSuccess: (res) => {
      toast.success(`Processed: ${res.data.processed}`);
      toast.error(`Error: ${res.data.errors}`);
    },
  });
  const userData = user?.data as UserResponse;

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Typography>Loading user data...</Typography>
      </Box>
    );
  }

  if (!userData) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Typography color="error">Failed to load user data</Typography>
      </Box>
    );
  }

  return (
    <Stack direction="column" gap={3} width="100%">
      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          User Details
        </Typography>
        <Stack direction="column" gap={1}>
          <Typography>
            <strong>Name:</strong> {userData.user.name}
          </Typography>
          <Typography>
            <strong>Username:</strong> {userData.user.username}
          </Typography>
          <Typography>
            <strong>ID:</strong> {userData.user.uid}
          </Typography>
          <Typography>
            <strong>Bio:</strong> {userData.user.bio || "No bio available"}
          </Typography>
          <Typography>
            <strong>Role:</strong> {userData.user.role}
          </Typography>
          <Typography>
            <strong>Tag:</strong> {userData.user.tag}
          </Typography>
        </Stack>
      </Paper>
      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="body1" gutterBottom color="primary">
          Generate Embeddings (before starting a chat, please generate
          embeddings once)
          {generateEmbeddings.isPending && (
            <>
              <br />
              <span style={{ color: "red", fontStyle: "italic" }}>
                Do not try to start a chat, please wait for the embeddings to be
                generated
              </span>
            </>
          )}
        </Typography>
        {generateEmbeddings.isPending ? (
          <CircularProgress size={20} />
        ) : (
          <Button
            variant="contained"
            disabled={generateEmbeddings.isPending}
            color="primary"
            onClick={() => generateEmbeddings.mutate()}
          >
            Generate Embeddings
          </Button>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          My Recipes ({userData.userRecipes.length})
        </Typography>
        {userData.userRecipes.filter((item) => item.status !== "draft").length >
        0 ? (
          <Stack direction="column" gap={1}>
            {userData.userRecipes
              .filter((item) => item.status !== "draft")
              .map((recipe) => (
                <Box
                  key={recipe.id}
                  sx={{ p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    {recipe.name}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Difficulty: {recipe.difficulty} | Servings:{" "}
                    {recipe.servings} | Prep: {recipe.prepTime}min | Cook:{" "}
                    {recipe.cookTime}min
                  </Typography>
                </Box>
              ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No recipes created yet</Typography>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          Liked Recipes ({userData.likedRecipes.length})
        </Typography>
        {userData.likedRecipes.length > 0 ? (
          <Stack direction="column" gap={1}>
            {userData.likedRecipes.map((recipe) => (
              <Box
                key={recipe.id}
                sx={{ p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  {recipe.name}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Difficulty: {recipe.difficulty} | Servings: {recipe.servings}{" "}
                  | Prep: {recipe.prepTime}min | Cook: {recipe.cookTime}min
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No liked recipes yet</Typography>
        )}
      </Paper>
    </Stack>
  );
};

interface UserResponse {
  user: {
    uid: string;
    username: string;
    bio: string;
    createdAt: string;
    lastSeen: string;
    name: string;
    image: null | string;
    dob: null | string;
    gender: null | string;
    termsAccepted: boolean;
    role: string;
    tag: string;
  };
  likedRecipes: IRecipe[];
  userRecipes: IRecipe[];
}

interface IRecipe {
  id: string;
  name: string;
  slug: string;
  ingress: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  status: string;
  difficulty: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  deletedAt: null | string;
  private: boolean;
  searchVector: null | string;
}
export default App;
