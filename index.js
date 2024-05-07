const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MOGONDB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define schema for the data
const dataSchema = new mongoose.Schema({
  room: String,
  name: String,
  date: String,
  startTime: String,
  endTime: String,
});

// Create model based on schema
const Data = mongoose.model('Data', dataSchema);

// Cache middleware
let cachedData = null;

// Middleware for checking duplicate bookings
async function checkDuplicateBooking(req, res, next) {
  const { room, date, startTime, endTime } = req.body;
  try {
    const isDuplicate = await Data.exists({
      room,
      date,
      $or: [
        { startTime: { $gte: startTime, $lt: endTime } },
        { endTime: { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
      ],
    });

    if (isDuplicate) {
      return res.status(400).json({
        error: 'This time slot is already booked. Please select another time.',
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Routes
app.get('/api/data', async (req, res) => {
  try {
    if (cachedData) {
      return res.json(cachedData);
    }
    const data = await Data.find({}, { _id: 0 }).lean(); // Use lean query
    cachedData = data;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/data', checkDuplicateBooking, async (req, res) => {
  try {
    const inputData = req.body;
    await Data.create(inputData);
    cachedData = null; // Invalidate cache
    res.json({ message: 'Data received and stored in MongoDB successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/data', async (req, res) => {
  try {
    await Data.deleteMany({});
    cachedData = null; // Invalidate cache
    res.json({ message: 'All data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/data/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await Data.deleteOne({ _id: id });
    if (result.deletedCount === 1) {
      cachedData = null; // Invalidate cache
      res.json({ message: `Data with ID ${id} deleted successfully` });
    } else {
      res.status(404).json({ error: `Data with ID ${id} not found` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
