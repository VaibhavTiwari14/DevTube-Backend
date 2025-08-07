import { Router } from "express";
import {
  changePassword,
  getUserChannelProfile,
  getUserWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);
router.route("/refreshTokens").post(refreshAccessToken);

// secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/profile").get(verifyJWT, getCurrentUser);
router.route("/channel/:username").get(getUserChannelProfile);
router.route("/watchHistory").get(verifyJWT, getUserWatchHistory);
router.route("/updateAccount").patch(verifyJWT, updateAccountDetails);
router.route("/changePassword").put(verifyJWT, changePassword);
router
  .route("/updateAvatar")
  .put(
    verifyJWT,
    upload.fields([{ name: "avatar", maxCount: 1 }]),
    updateUserAvatar
  );
router
  .route("/updateCoverImage")
  .put(
    verifyJWT,
    upload.fields([{ name: "coverImage", maxCount: 1 }]),
    updateUserCoverImage
  );

export default router;
