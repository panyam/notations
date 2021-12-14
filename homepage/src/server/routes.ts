import express = require("express");

const router = express.Router();
const wrapAsync =
  (fn: any) =>
  (...args: any[]) =>
    Promise.resolve(fn(...args)).catch(args[2]);

/* GET home page. */
router.get("/", function (req: any, res: any, next: any) {
  const userID = req.session?.loggedInUser?.id || null;
  res.render("site/index.html", {
    title: "Notations Homepage",
    h1: "Welcome",
    userId: userID,
  });
});

module.exports = router;
