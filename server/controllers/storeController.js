/**
 * Store controller for Airbnb app
 * Handles home listings, bookings, and favourites
 */

const Home = require('../models/home');
const User = require('../models/user');

module.exports = {
  // GET / - Home page
  getIndex: async (req, res) => {
    try {
      const registeredHomes = await Home.find().limit(6);
      res.render('store/index', {
        pageTitle: 'Airbnb - Find your perfect stay',
        currentPage: 'index',
        registeredHomes,
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    } catch (error) {
      console.error('Error fetching homes:', error);
      res.render('store/index', {
        pageTitle: 'Airbnb - Find your perfect stay',
        currentPage: 'index',
        registeredHomes: [],
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    }
  },

  // GET /homes - List all homes
  getHomes: async (req, res) => {
    try {
      const registeredHomes = await Home.find();
      res.render('store/home-list', {
        pageTitle: 'All Homes',
        currentPage: 'homes',
        registeredHomes,
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    } catch (error) {
      console.error('Error fetching homes:', error);
      res.render('store/home-list', {
        pageTitle: 'All Homes',
        currentPage: 'homes',
        registeredHomes: [],
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    }
  },

  // GET /bookings - User bookings
  getBookings: (req, res) => {
    res.render('store/bookings', {
      pageTitle: 'My Bookings',
      currentPage: 'bookings',
      user: req.session.user || null,
      isLoggedIn: req.isLoggedIn
    });
  },

  // GET /favourites - User favourites
  getFavouriteList: async (req, res) => {
    try {
      let favouriteHomes = [];

      if (req.session.user && req.session.user._id) {
        const user = await User.findById(req.session.user._id).populate('favourites');
        favouriteHomes = user ? user.favourites : [];
      }

      res.render('store/favourite-list', {
        pageTitle: 'My Favourites',
        currentPage: 'favourites',
        favouriteHomes,
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    } catch (error) {
      console.error('Error fetching favourite homes:', error);
      res.render('store/favourite-list', {
        pageTitle: 'My Favourites',
        currentPage: 'favourites',
        favouriteHomes: [],
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    }
  },

  // GET /homes/:homeId - Home details
  getHomeDetails: async (req, res) => {
    try {
      const { homeId } = req.params;
      const home = await Home.findById(homeId);

      if (!home) {
        return res.status(404).render('404', {
          pageTitle: 'Home Not Found',
          user: req.session.user || null,
          isLoggedIn: req.isLoggedIn
        });
      }

      res.render('store/home-detail', {
        pageTitle: 'Home Details',
        currentPage: 'home-detail',
        home,
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    } catch (error) {
      console.error('Error fetching home details:', error);
      res.status(500).render('404', {
        pageTitle: 'Error',
        user: req.session.user || null,
        isLoggedIn: req.isLoggedIn
      });
    }
  },

  // POST /favourites - Add to favourites
  postAddToFavourite: async (req, res) => {
    try {
      console.log('POST /favourites - Request body:', req.body);
      console.log('POST /favourites - Session user:', req.session.user);
      
      const { homeId } = req.body;

      if (!homeId) {
        return res.status(400).json({ error: 'Home ID is required' });
      }

      if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ error: 'User not logged in' });
      }

      const user = await User.findById(req.session.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('User favourites before:', user.favourites);

      // Check if already in favourites
      if (user.favourites.includes(homeId)) {
        return res.json({ message: 'Already in favourites', homeId, isFavourite: true });
      }

      // Add to favourites
      user.favourites.push(homeId);
      await user.save();

      console.log('User favourites after:', user.favourites);

      res.json({ message: 'Added to favourites', homeId, isFavourite: true });
    } catch (error) {
      console.error('Error adding to favourites:', error);
      res.status(500).json({ error: 'Failed to add to favourites' });
    }
  },

  // POST /favourites/delete/:homeId - Remove from favourites
  postRemoveFromFavourite: async (req, res) => {
    try {
      const { homeId } = req.params;

      if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ error: 'User not logged in' });
      }

      const user = await User.findById(req.session.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if home is in favourites
      if (!user.favourites.includes(homeId)) {
        return res.json({ message: 'Not in favourites', homeId, isFavourite: false });
      }

      // Remove from favourites
      user.favourites = user.favourites.filter(fav => fav.toString() !== homeId);
      await user.save();

      res.json({ message: 'Removed from favourites', homeId, isFavourite: false });
    } catch (error) {
      console.error('Error removing from favourites:', error);
      res.status(500).json({ error: 'Failed to remove from favourites' });
    }
  }
};