const Home = require("../models/home");
const fs = require("fs");
const path = require("path");

// Uploads directory path (same as in app.js - server/uploads)
const uploadsDir = path.join(__dirname, '..', 'uploads');

exports.getAddHome = (req, res, next) => {
  res.render("host/edit-home", {
    pageTitle: "Add Home to airbnb",
    currentPage: "addHome",
    editing: false,
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
  });
};

exports.getEditHome = (req, res, next) => {
  const homeId = req.params.homeId;
  const editing = req.query.editing === "true";

  Home.findById(homeId).then((home) => {
    if (!home) {
      console.log("Home not found for editing.");
      return res.redirect("/host/host-home-list");
    }

    console.log(homeId, editing, home);
    res.render("host/edit-home", {
      home: home,
      pageTitle: "Edit your Home",
      currentPage: "host-homes",
      editing: editing,
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  });
};

exports.getHostHomes = (req, res, next) => {
  Home.find().then((registeredHomes) => {
    res.render("host/host-home-list", {
      registeredHomes: registeredHomes,
      pageTitle: "Host Homes List",
      currentPage: "host-homes",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  });
};

exports.postAddHome = async (req, res, next) => {
  try {
    const { houseName, price, location, rating, description } = req.body;
    console.log('POST /host/add-home - Body:', { houseName, price, location, rating, description });
    console.log('POST /host/add-home - File:', req.file);

    if (!req.file) {
      return res.status(422).send("No image provided");
    }

    // Validate required fields
    if (!houseName || !price || !location || !rating) {
      return res.status(422).send("Missing required fields: houseName, price, location, and rating are required");
    }

    // Validate data types
    const priceNum = parseFloat(price);
    const ratingNum = parseFloat(rating);

    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(422).send("Price must be a positive number");
    }

    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return res.status(422).send("Rating must be a number between 0 and 5");
    }

    const photo = '/uploads/' + req.file.filename;

    const home = new Home({
      houseName,
      price: priceNum,
      location,
      rating: ratingNum,
      photo,
      description: description || '',
    });

    await home.save();
    console.log("Home Saved successfully:", home._id);
    res.redirect("/host/host-home-list");
  } catch (error) {
    console.error("Error saving home:", error);
    // If file was uploaded but save failed, try to delete the file
    if (req.file) {
      const filePath = path.join(uploadsDir, req.file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }
    res.status(500).send("Error saving home: " + (error.message || "Unknown error"));
  }
};

exports.postEditHome = async (req, res, next) => {
  try {
    const { id, houseName, price, location, rating, description } = req.body;
    console.log('POST /host/edit-home - Body:', { id, houseName, price, location, rating, description });
    console.log('POST /host/edit-home - File:', req.file);

    if (!id) {
      return res.status(400).send("Home ID is required");
    }

    const home = await Home.findById(id);
    if (!home) {
      return res.status(404).send("Home not found");
    }

    // Validate required fields
    if (!houseName || !price || !location || !rating) {
      return res.status(422).send("Missing required fields: houseName, price, location, and rating are required");
    }

    // Validate data types
    const priceNum = parseFloat(price);
    const ratingNum = parseFloat(rating);

    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(422).send("Price must be a positive number");
    }

    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return res.status(422).send("Rating must be a number between 0 and 5");
    }

    // Update home fields
    home.houseName = houseName;
    home.price = priceNum;
    home.location = location;
    home.rating = ratingNum;
    home.description = description || '';

    // Handle new photo upload
    if (req.file) {
      // Delete old photo file if it exists
      if (home.photo) {
        const filename = home.photo.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, filename);
        fs.unlink(filePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error("Error while deleting old file:", err);
          }
        });
      }
      home.photo = '/uploads/' + req.file.filename;
    }

    await home.save();
    console.log("Home updated successfully:", home._id);
    res.redirect("/host/host-home-list");
  } catch (error) {
    console.error("Error updating home:", error);
    // If new file was uploaded but save failed, try to delete the new file
    if (req.file) {
      const filePath = path.join(uploadsDir, req.file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }
    res.status(500).send("Error updating home: " + (error.message || "Unknown error"));
  }
};

exports.postDeleteHome = (req, res, next) => {
  const homeId = req.params.homeId;
  console.log("Came to delete ", homeId);
  Home.findById(homeId)
    .then((home) => {
      if (home && home.photo) {
        // Delete the associated image file
        const filename = home.photo.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, filename);
        fs.unlink(filePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.log("Error while deleting file ", err);
          }
        });
      }
      return Home.findByIdAndDelete(homeId);
    })
    .then(() => {
      res.redirect("/host/host-home-list");
    })
    .catch((error) => {
      console.log("Error while deleting ", error);
    });
};
