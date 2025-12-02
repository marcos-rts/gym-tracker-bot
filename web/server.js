import express from "express";
import knexfile from "./knexfile.js";
import knex from "knex";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const db = knex(knexfile);

// resolver dirname ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// rotas
import indexRoutes from "./routes/index.js";
import userRoutes from "./routes/users.js";
import routineRoutes from "./routes/routines.js";
import sessionRoutes from "./routes/sessions.js";

app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use("/", indexRoutes);
app.use("/users", userRoutes);
app.use("/routines", routineRoutes);
app.use("/sessions", sessionRoutes);

app.listen(process.env.PORT, () => {
    console.log(`WebApp rodando na porta ${process.env.PORT}`);
});
