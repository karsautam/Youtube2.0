import express from "express";
import { login, updateprofile, getUserById } from "../controllers/auth.js";
const routes = express.Router();

routes.post("/login", login);
routes.get("/:id", getUserById);
routes.patch("/update/:id", updateprofile);
export default routes;
