/**
 * Store controller for Airbnb app
 * Handles home listings, bookings, and favourites
 */

const Home = require('../models/home');
const User = require('../models/user');
const mongoose = require('mongoose');

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

      // Check if home is in user's favourites
      let isFavourite = false;
      if (req.session.user && req.session.user._id) {
        const user = await User.findById(req.session.user._id);
        if (user && user.favourites) {
          const favouriteStrings = (Array.isArray(user.favourites) ? user.favourites : [])
            .filter(id => id && mongoose.Types.ObjectId.isValid(id))
            .map(id => id.toString())
            .filter(Boolean);
          isFavourite = favouriteStrings.includes(homeId);
        }
      }

      res.render('store/home-detail', {
        pageTitle: 'Home Details',
        currentPage: 'home-detail',
        home,
        isFavourite,
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
    console.log('Body:', req.body, 'User:', req.user);
    console.log('Received body:', req.body);
    console.log('User ID:', req.user?._id);
    console.log('Home ID:', req.body?.homeId);

    try {
      const sessionUserId = req.session?.user?._id;
      const { homeId } = req.body || {};

      console.log('Session user from session:', req.session?.user);
      console.log('Derived sessionUserId:', sessionUserId);
      console.log('Incoming homeId:', homeId);

      if (!sessionUserId) {
        return res.status(401).json({ success: false, message: 'User must be logged in' });
      }

      if (!homeId) {
        return res.status(400).json({ success: false, message: 'Home ID is required' });
      }

      const isValidObjectId = mongoose.Types.ObjectId.isValid(homeId);
      console.log('Is valid ObjectId?', isValidObjectId);
      if (!isValidObjectId) {
        return res.status(400).json({ success: false, message: 'Invalid home ID' });
      }

      let user, home;
      try {
        [user, home] = await Promise.all([
          User.findById(sessionUserId),
          Home.findById(homeId)
        ]);
      } catch (findErr) {
        console.error('DB find error:', findErr);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      console.log('Found user?', !!user, 'Found home?', !!home);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!home) {
        return res.status(404).json({ success: false, message: 'Home not found' });
      }

      // Sanitize favourites: remove nulls/invalids and dedupe
      if (!Array.isArray(user.favourites)) user.favourites = [];
      user.favourites = user.favourites
        .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      user.favourites = Array.from(new Set(user.favourites.map(id => id.toString())))
        .map(id => new mongoose.Types.ObjectId(id));

      const homeObjectId = new mongoose.Types.ObjectId(homeId);
      const favouriteStrings = (Array.isArray(user.favourites) ? user.favourites : [])
        .filter(id => !!id)
        .map(id => (typeof id?.toString === 'function' ? id.toString() : undefined))
        .filter(Boolean);
      const alreadyFavourite = favouriteStrings.includes(homeObjectId.toString());

      if (alreadyFavourite) {
        return res.status(200).json({ success: false, message: 'Home already added to favourites' });
      }

      // Push and save
      user.favourites.push(homeObjectId);
      try {
        await user.save();
        return res.status(201).json({ success: true, isFavourite: true, message: 'Added to favourites' });
      } catch (saveErr) {
        console.error('DB save error:', saveErr);
        return res.status(500).json({ success: false, message: 'Could not save favourite' });
      }
    } catch (error) {
      console.error('Error adding to favourites:', error);
      return res.status(500).json({ success: false, message: 'Failed to add to favourites' });
    }
  },

  // POST /favourites/toggle - Toggle favourite status
  postToggleFavourite: async (req, res) => {
    try {
      const sessionUserId = req.session?.user?._id;
      const { homeId } = req.body || {};

      if (!sessionUserId) {
        return res.status(401).json({ success: false, message: 'User must be logged in' });
      }

      if (!homeId) {
        return res.status(400).json({ success: false, message: 'Home ID is required' });
      }

      if (!mongoose.Types.ObjectId.isValid(homeId)) {
        return res.status(400).json({ success: false, message: 'Invalid home ID' });
      }

      const [user, home] = await Promise.all([
        User.findById(sessionUserId),
        Home.findById(homeId)
      ]);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!home) {
        return res.status(404).json({ success: false, message: 'Home not found' });
      }

      // Sanitize favourites: remove nulls/invalids and dedupe
      if (!Array.isArray(user.favourites)) user.favourites = [];
      user.favourites = user.favourites
        .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      user.favourites = Array.from(new Set(user.favourites.map(id => id.toString())))
        .map(id => new mongoose.Types.ObjectId(id));

      const homeObjectId = new mongoose.Types.ObjectId(homeId);
      const favouriteStrings = (Array.isArray(user.favourites) ? user.favourites : [])
        .filter(id => !!id)
        .map(id => (typeof id?.toString === 'function' ? id.toString() : undefined))
        .filter(Boolean);
      const isCurrentlyFavourite = favouriteStrings.includes(homeObjectId.toString());

      // Toggle favourite status
      if (isCurrentlyFavourite) {
        // Remove from favourites
        user.favourites = user.favourites.filter(id => id.toString() !== homeObjectId.toString());
        await user.save();
        return res.json({ success: true, isFavourite: false, message: 'Removed from favourites' });
      } else {
        // Add to favourites
        user.favourites.push(homeObjectId);
        await user.save();
        return res.json({ success: true, isFavourite: true, message: 'Added to favourites' });
      }
    } catch (error) {
      console.error('Error toggling favourite:', error);
      return res.status(500).json({ success: false, message: 'Failed to toggle favourite' });
    }
  },

  // POST /favourites/delete/:homeId - Remove from favourites
  postRemoveFromFavourite: async (req, res) => {
    try {
      // Extract homeId from params (support both :homeId and :id)
      const homeId = req.params.homeId || req.params.id;

      console.log('Deleting favourite:', homeId, 'for user:', req.session?.user?._id);

      // Check authentication
      if (!req.session || !req.session.user || !req.session.user._id) {
        return res.status(401).json({ error: 'User not logged in' });
      }

      const userId = req.session.user._id;

      // Validate homeId
      if (!homeId) {
        return res.status(400).json({ error: 'Home ID is required' });
      }

      if (!mongoose.Types.ObjectId.isValid(homeId)) {
        return res.status(400).json({ error: 'Invalid home ID format' });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Sanitize favourites: remove nulls/invalids and dedupe
      if (!Array.isArray(user.favourites)) user.favourites = [];
      user.favourites = user.favourites
        .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      user.favourites = Array.from(new Set(user.favourites.map(id => id.toString())))
        .map(id => new mongoose.Types.ObjectId(id));

      // Convert to strings for comparison
      const favouriteStrings = user.favourites.map(fav => fav.toString());

      // Check if home is in favourites
      if (!favouriteStrings.includes(homeId.toString())) {
        return res.status(404).json({ error: 'Not in favourites' });
      }

      // Remove from favourites using pull
      const homeObjectId = new mongoose.Types.ObjectId(homeId);
      user.favourites = user.favourites.filter(id => id.toString() !== homeObjectId.toString());

      // Save user
      await user.save();

      return res.json({
        success: true,
        message: 'Removed from favourites',
        isFavourite: false
      });

    } catch (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ error: error.message || 'Failed to remove from favourites' });
    }
  }
};
