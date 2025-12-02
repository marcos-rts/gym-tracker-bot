import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const routines = await req.db("routines").select();
  res.render("routines", { routines });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const routine = await req.db("routines").where({ id }).first();

  const exercises = await req.db("routine_exercises")
    .join("exercises", "routine_exercises.exercise_id", "exercises.id")
    .where("routine_exercises.routine_id", id)
    .orderBy("routine_exercises.position");

  res.render("routine_detail", { routine, exercises });
});

export default router;
