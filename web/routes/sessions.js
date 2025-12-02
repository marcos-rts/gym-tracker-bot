import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const sessions = await req.db("sessions")
    .join("users", "sessions.user_id", "users.id")
    .select("sessions.*", "users.username");

  res.render("sessions", { sessions });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;

  const session = await req.db("sessions")
    .where({ "sessions.id": id })
    .first();

  const sets = await req.db("sets")
    .join("exercises", "sets.exercise_id", "exercises.id")
    .where("sets.session_id", id)
    .orderBy("set_index");

  res.render("session_detail", { session, sets });
});

export default router;
