import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const usersCount = await req.db("users").count({ total: "*" }).first();
  const routinesCount = await req.db("routines").count({ total: "*" }).first();
  const sessionsCount = await req.db("sessions").count({ total: "*" }).first();

  res.render("index", {
    stats: {
      users: usersCount.total,
      routines: routinesCount.total,
      sessions: sessionsCount.total
    }
  });
});

export default router;
