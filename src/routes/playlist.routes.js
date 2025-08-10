import { Router } from "express";
import {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeVideoFromPlaylist,
  updatePlaylist,
} from "../controllers/playlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const playlistRouter = Router();

playlistRouter.use(verifyJWT);

playlistRouter.route("/create").post(createPlaylist);

playlistRouter.route("/:playlistId").get(getPlaylistById);
playlistRouter.route("/:playlistId").patch(updatePlaylist);
playlistRouter.route("/:playlistId").delete(deletePlaylist);

playlistRouter.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
playlistRouter
  .route("/remove/:videoId/:playlistId")
  .patch(removeVideoFromPlaylist);

playlistRouter.route("/user/:userId").get(getUserPlaylists);

export default playlistRouter;
