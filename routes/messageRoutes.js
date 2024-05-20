import express from "express";
import {
  getAllMessage,
  sendMessage,
  deleteMessage,
} from "../controllers/messageController.js";
import { isAuthenticated } from "../middlewares/auth.js";
const router = express.Router();

router.post("/send", sendMessage);
router.post("/getAll", getAllMessage);
router.delete("/delete/:id",isAuthenticated, deleteMessage);



export default router;
