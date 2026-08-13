const mongoose = require('mongoose');
const { required } = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(required('MONGODB_URI'));

    console.log("[rescuebite] MongoDB connected successfully");
  } catch (error) {
    console.error("[rescuebite] MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
