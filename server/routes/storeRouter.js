// External Module
const express = require("express");
const storeRouter = express.Router();

// Local Module
const storeController = require("../controllers/storeController");

storeRouter.get("/", storeController.getIndex);
storeRouter.get("/homes", storeController.getHomes);
storeRouter.get("/bookings", storeController.getBookings);
storeRouter.get("/favourites", storeController.getFavouriteList);

// Session check API for frontend guards
storeRouter.get('/api/check-session', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.user) });
});

storeRouter.get("/homes/:homeId", storeController.getHomeDetails);
storeRouter.post("/favourites", storeController.postAddToFavourite);
storeRouter.post("/favourites/toggle", storeController.postToggleFavourite);

// Support both :homeId and :id parameters
storeRouter.post("/favourites/delete/:homeId", storeController.postRemoveFromFavourite);
storeRouter.post("/favourites/delete/:id", (req, res, next) => {
  // Convert :id to :homeId for controller
  req.params.homeId = req.params.id;
  next();
}, storeController.postRemoveFromFavourite);

module.exports = storeRouter;
