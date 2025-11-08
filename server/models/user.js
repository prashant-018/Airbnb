const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required']
  },
  lastName: String,
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  userType: {
    type: String,
    enum: ['guest', 'host'],
    default: 'guest'
  },
  favourites: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Home'
      }
    ],
    default: [],
    validate: {
      validator: function (arr) {
        if (!Array.isArray(arr)) return false;
        return arr.every(id => id && mongoose.Types.ObjectId.isValid(id));
      },
      message: 'Favourites must contain only valid ObjectIds'
    },
    set: function (arr) {
      if (!Array.isArray(arr)) return [];
      const filtered = arr.filter(id => id && mongoose.Types.ObjectId.isValid(id));
      // Deduplicate
      const unique = Array.from(new Set(filtered.map(id => id.toString()))).map(id => new mongoose.Types.ObjectId(id));
      return unique;
    }
  }
});

// Ensure sanitization before save as a last line of defense
userSchema.pre('save', function (next) {
  if (!Array.isArray(this.favourites)) {
    this.favourites = [];
    return next();
  }
  this.favourites = this.favourites
    .filter(id => id && mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));
  // Deduplicate
  const unique = Array.from(new Set(this.favourites.map(id => id.toString()))).map(id => new mongoose.Types.ObjectId(id));
  this.favourites = unique;
  next();
});

module.exports = mongoose.model('User', userSchema);
