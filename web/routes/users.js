import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const users = await req.db("users").select();
  res.render("users", { users });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const user = await req.db("users").where({ id }).first();
  const routines = await req.db("routines").where({ user_id: id });
  const sessions = await req.db("sessions").where({ user_id: id });

  res.render("user_detail", { user, routines, sessions });
});

export default router;
