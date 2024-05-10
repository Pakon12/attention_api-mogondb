const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require("dotenv")
const NodeCache = require("node-cache");


const cache = new NodeCache();


dotenv.config()

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose.connect( process.env.MOGONDB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define schema for the data
const dataSchema = new mongoose.Schema({
    id:String,
    room: String,
    name:String,
    date: String,
    startTime: String,
    endTime: String,
    phone:String
});

dataSchema.index({ room: 1, date: 1, startTime: 1, endTime: 1 ,phone:1});

// Create model based on schema
const Data = mongoose.model('Data', dataSchema);


// Get all data
app.get('/api/data', async (req, res) => {
    
    try {
        const cachedData = cache.get('allData');
        if (cachedData) {
            return res.json(cachedData);
        }
        const data = await Data.find({}, { _id: 0 });
        cache.set('allData', data, /* optional: specify cache expiration */);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add data
app.post('/api/data', async (req, res) => {
    const inputData = req.body;
    // console.log(inputData)
    try {
        const isDuplicate = await Data.findOne({
            room: inputData.room,
            date: inputData.date,
            $or: [
                { startTime: { $gte: inputData.startTime, $lt: inputData.endTime } },
                { endTime: { $gt: inputData.startTime, $lte: inputData.endTime } },
                { startTime: { $lte: inputData.startTime }, endTime: { $gte: inputData.endTime } }
            ]
        });

        if (isDuplicate) {
            return res.status(400).json({ error: "This time slot is already booked. Please select another time." });
        }

        await Data.create(inputData);
        cache.del('allData');
        res.json({ message: "Data received and stored in MongoDB successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete all data
app.delete('/api/data', async (req, res) => {
    try {
        await Data.deleteMany({});
        cache.flushAll();
        res.json({ message: "All data deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete data by ID
app.delete('/api/data/:id', async (req, res) => {
    const id = req.params.id;
    // console.log(id)
    try {
        const result = await Data.deleteOne({ id: id });
        if (result.deletedCount === 1) {
            cache.del('allData');
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
