import SendIcon from "@mui/icons-material/Send";
import { IconButton, Stack, TextField } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { toast } from "react-toastify";
import { API_URL } from "../config";

export const SearchUser = () => {
  const [searchUser, setSearchUser] = useState("");

  const searchUserMutation = useMutation({
    mutationFn: () =>
      axios.get(`${API_URL}/api/user/search?user=${searchUser}`),
    onSuccess: (res) => {
      const userId = res.data.userId;
      const username = res.data.username;
      console.log(userId, username, res.data);
      localStorage.setItem("userid", userId);
      localStorage.setItem("username", username);
      window.location.href = `/${username}`;
    },
    onError: () => {
      toast.error("User not found, search again");
    },
  });

  const handleSearchForUser = () => {
    searchUserMutation.mutate();
  };

  return (
    <Stack direction="row" p={4} gap={2} alignItems="center">
      <TextField
        fullWidth
        value={searchUser}
        onChange={(e) => setSearchUser(e.target.value)}
        placeholder="Search User"
      />
      <IconButton
        color="primary"
        onClick={handleSearchForUser}
        disabled={!searchUser.trim()}
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
  );
};
