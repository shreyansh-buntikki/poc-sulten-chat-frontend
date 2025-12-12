import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { SearchUser } from "./components/SearchUser";
import { API_URL } from "./config";
import { AgenticCall } from "./components/AgenticCall";

export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "69420",
  accept: "application/json",
  "Content-Type": "application/json",
};
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
            Sulten Chatbot Playground
          </Typography>
          <ToastContainer position="top-center" />
          <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <Routes>
              <Route path="/" element={<SearchUser />} />
              <Route path="/:username" element={<ChatContainer />} />
              <Route path="/call/:username" element={<AgenticCall />} />
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
  const [selectedModel, setSelectedModel] = useState("gemini");
  const navigate = useNavigate();

  const askAiMutation = useMutation({
    mutationFn: (text: string) =>
      axios.post(
        `${API_URL}/api/ollama/${username}/chat`,
        {
          message: text,
          model: selectedModel,
        },
        {
          headers: NGROK_HEADERS,
        }
      ),
    onSuccess: (res) => {
      const message = res.data.response;
      setMessages([...messages, { text: message, timestamp: new Date() }]);
    },
    onError: () => {
      toast.error(
        "Something went wrong..., Model overloaded, please try again later or select a different model"
      );
    },
  });

  const getChatHistory = useQuery({
    queryKey: ["chatHistory", username],
    queryFn: () =>
      axios.get(`${API_URL}/api/ollama/${username}/history`, {
        headers: NGROK_HEADERS,
      }),
    enabled: !!username && messages.length === 0,
  });

  useEffect(() => {
    if (getChatHistory.isLoading) {
      return;
    }
    if (getChatHistory.data) {
      const chatHistory = getChatHistory.data.data
        .previousMessages as IChatHistory[];
      setMessages(
        chatHistory.map((item) => ({
          text: item.kwargs.content,
          timestamp: new Date(),
          aiResponse: item.id.includes("HumanMessage"),
        }))
      );
    }
  }, [getChatHistory.data?.data]);

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
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          bgcolor: "#f5f5f5",
        }}
      >
        <Button
          variant="contained"
          color="primary"
          sx={{
            margin: 2,
            maxWidth: "200px",
          }}
          onClick={() => navigate(`/call/${username}`)}
        >
          Do agentic call
        </Button>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
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
              <Box>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </Box>
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
        <UserResponse
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
        />
      </Box>
    </Stack>
  );
};

const UserResponse = ({
  selectedModel,
  setSelectedModel,
}: {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}) => {
  const { username } = useParams();
  const [userRecipesLimit, setUserRecipesLimit] = useState(10);
  const [likedRecipesLimit, setLikedRecipesLimit] = useState(10);
  const [userRecipesSearch, setUserRecipesSearch] = useState("");
  const [likedRecipesSearch, setLikedRecipesSearch] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: () =>
      axios.get(`${API_URL}/api/user/${username}`, {
        headers: NGROK_HEADERS,
      }),
  });

  // const generateEmbeddings = useMutation({
  //   mutationFn: () =>
  //     axios.post(`${API_URL}/api/user/${username}/ollama/generate-embeddings`),
  //   onError: () => {
  //     toast.error("Something went wrong...");
  //   },
  //   onSuccess: (res) => {
  //     toast.success(`Processed: ${res.data.processed}`);
  //     toast.error(`Error: ${res.data.errors}`);
  //   },
  // });
  const userData = user?.data as UserResponse;

  const filteredUserRecipes = useMemo(() => {
    if (!userData?.userRecipes) return [];
    return userData.userRecipes
      .filter((item) => item.status !== "draft")
      .filter((recipe) =>
        recipe.name.toLowerCase().includes(userRecipesSearch.toLowerCase())
      );
  }, [userData?.userRecipes, userRecipesSearch]);

  const filteredLikedRecipes = useMemo(() => {
    if (!userData?.likedRecipes) return [];
    return userData.likedRecipes.filter((recipe) =>
      recipe.name.toLowerCase().includes(likedRecipesSearch.toLowerCase())
    );
  }, [userData?.likedRecipes, likedRecipesSearch]);

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
      {/* <Paper elevation={2} sx={{ p: 2 }}>
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
      </Paper> */}
      <Paper elevation={2} sx={{ p: 2 }}>
        {/* <Typography variant="body1" gutterBottom color="primary">
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
        )} */}
        <Typography variant="body1" gutterBottom color="primary">
          Select Model
        </Typography>

        <Select
          fullWidth
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          <MenuItem key="gemini" value="gemini">
            Gemini
          </MenuItem>
          <MenuItem key="claude" value="claude">
            Claude
          </MenuItem>
          <MenuItem key="openai" value="openai">
            OpenAI
          </MenuItem>
          <MenuItem key="groq" value="groq">
            Groq
          </MenuItem>
        </Select>
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" color="primary">
            My Recipes (
            {
              userData.userRecipes.filter((item) => item.status !== "draft")
                .length
            }
            )
          </Typography>
          <TextField
            size="small"
            placeholder="Search recipes..."
            value={userRecipesSearch}
            onChange={(e) => setUserRecipesSearch(e.target.value)}
            sx={{ width: 200 }}
          />
        </Stack>
        {userData.userRecipes.filter((item) => item.status !== "draft").length >
        0 ? (
          <Stack direction="column" gap={1}>
            {filteredUserRecipes.slice(0, userRecipesLimit).map((recipe) => (
              <Box
                key={recipe.id}
                sx={{ p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  {recipe.name}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Difficulty: {recipe.difficulty} | Servings: {recipe.servings}{" "}
                  | Cook: {recipe.cookTime}min
                </Typography>
              </Box>
            ))}
            {filteredUserRecipes.length > userRecipesLimit && (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setUserRecipesLimit((prev) => prev + 10)}
                sx={{ mt: 1 }}
              >
                Show More ({filteredUserRecipes.length - userRecipesLimit}{" "}
                remaining)
              </Button>
            )}
            {filteredUserRecipes.length === 0 && userRecipesSearch && (
              <Typography color="text.secondary" align="center" py={2}>
                No recipes found matching "{userRecipesSearch}"
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography color="text.secondary">No recipes created yet</Typography>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" color="primary">
            Liked Recipes ({userData.likedRecipes.length})
          </Typography>
          <TextField
            size="small"
            placeholder="Search recipes..."
            value={likedRecipesSearch}
            onChange={(e) => setLikedRecipesSearch(e.target.value)}
            sx={{ width: 200 }}
          />
        </Stack>
        {userData.likedRecipes.length > 0 ? (
          <Stack direction="column" gap={1}>
            {filteredLikedRecipes.slice(0, likedRecipesLimit).map((recipe) => (
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
            {filteredLikedRecipes.length > likedRecipesLimit && (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setLikedRecipesLimit((prev) => prev + 10)}
                sx={{ mt: 1 }}
              >
                Show More ({filteredLikedRecipes.length - likedRecipesLimit}{" "}
                remaining)
              </Button>
            )}
            {filteredLikedRecipes.length === 0 && likedRecipesSearch && (
              <Typography color="text.secondary" align="center" py={2}>
                No recipes found matching "{likedRecipesSearch}"
              </Typography>
            )}
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

interface IChatHistory {
  lc: number;
  type: string;
  id: string[];
  kwargs: {
    content: string;
    additional_kwargs: Record<string, any>;
    response_metadata: Record<string, any>;
  };
}
export default App;
