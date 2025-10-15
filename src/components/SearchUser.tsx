import {
  Box,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";

export const SearchUser = () => {
  const [searchUser, setSearchUser] = useState("");
  const [debouncedSearchUser, setDebouncedSearchUser] = useState("");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const textFieldRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchUser(searchUser);
    }, 1500);
    return () => clearTimeout(handler);
  }, [searchUser]);

  const searchUserQuery = useQuery({
    queryKey: ["searchUser", { debouncedSearchUser }],
    queryFn: () => axios.get(`${API_URL}/api/user/search?user=${searchUser}`),
    enabled: debouncedSearchUser.length > 0,
  });

  const users = searchUserQuery.data?.data.users as IUser[];

  useEffect(() => {
    if (debouncedSearchUser && textFieldRef.current) {
      setAnchorEl(textFieldRef.current);
    } else {
      setAnchorEl(null);
    }
  }, [debouncedSearchUser, users]);

  const handleUserClick = (username: string) => {
    navigate(`/${username}`);
    setSearchUser("");
    setDebouncedSearchUser("");
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl && debouncedSearchUser);

  return (
    <Stack direction="row" p={4} gap={2} alignItems="center">
      <TextField
        fullWidth
        ref={textFieldRef}
        value={searchUser}
        onChange={(e) => setSearchUser(e.target.value)}
        placeholder="Search User"
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        slotProps={{
          paper: {
            sx: {
              width: anchorEl?.offsetWidth || 400,
              maxHeight: 400,
              mt: 1,
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {searchUserQuery.isLoading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={24} />
            </Box>
          ) : users && users.length > 0 ? (
            <List sx={{ p: 0 }}>
              {users.map((user) => (
                <ListItemButton
                  key={user.uid}
                  onClick={() => handleUserClick(user.username)}
                  sx={{
                    borderRadius: 1,
                    "&:hover": {
                      bgcolor: "primary.light",
                      color: "white",
                    },
                  }}
                >
                  <ListItemText
                    primary={user.name}
                    secondary={
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        @{user.username} • {user.tag}
                      </Typography>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" align="center">
              No users found
            </Typography>
          )}
        </Box>
      </Popover>
    </Stack>
  );
};

interface IUser {
  uid: string;
  username: string;
  bio: null | string;
  createdAt: "2021-08-24T01:15:23.109Z";
  lastSeen: string;
  name: string;
  image: null | string;
  dob: null | string;
  gender: null | string;
  messagingTokens: string;
  termsAccepted: boolean;
  role: string;
  tag: string;
}
