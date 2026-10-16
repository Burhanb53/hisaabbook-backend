const mongoose = require('mongoose');

// Only a SHA-256 hash of the token is stored, never the token itself.
const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token_hash: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true },
  device: String
}, { timestamps: true });

// Mongo removes expired tokens automatically
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
