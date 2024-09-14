const cors = require('cors');
const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const app = express();

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 });

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('your_database_name');
        const thresholdsCollection = db.collection('thresholds');
        const scoresCollection = db.collection('scores');
        const gamesCollection = db.collection('games');
        const EMGCollection = db.collection('EMG');

        // Get 10 top scores for the game
        app.get('/topScores/:gameId', async (req, res) => {
            try {
                const { gameId } = req.params;
                const topScores = await scoresCollection.find({ gameId }).sort({ score: -1 }).limit(10).toArray();
                res.status(200).json(topScores);
            } catch (error) {
                console.error('Error fetching top scores:', error);
                res.status(500).send('Error fetching top scores');
            }
        });

        // Add a new score to the database
        app.post('/score', async (req, res) => {
            try {
                const { gameSessionId, gameId, score } = req.body;
                await scoresCollection.insertOne({ gameSessionId, score });
                res.status(201).send('Score saved successfully');
            } catch (error) {
                console.error('Error saving score:', error);
                res.status(500).send('Error saving score');
            }
        });

        // Fetch the threshold for each game
        app.get('/threshold/:gameId', async (req, res) => {
            try {
                const { gameId } = req.params;
                const threshold = await thresholdsCollection.findOne({ gameId });
                res.status(200).json(threshold);
            } catch (error) {
                console.error('Error fetching threshold:', error);
                res.status(500).send('Error fetching threshold');
            }
        });

        // Set the threshold for a game
        app.post('/threshold', async (req, res) => {
            try {
                const { gameId, threshold } = req.body;
                await thresholdsCollection.updateOne({ gameId }, { $set: { threshold } }, { upsert: true });
                res.status(201).send('Threshold set successfully');
            } catch (error) {
                console.error('Error setting threshold:', error);
                res.status(500).send('Error setting threshold');
            }
        });

        // Fetch all the EMG details for a game session
        app.get('/getEMGdetails/:gameSessionId', async (req, res) => {
            try {
                const { gameSessionId } = req.params;
                const EMGdetails = await EMGCollection.find({ gameSessionId }).toArray();
                res.status(200).json(EMGdetails);
            } catch (error) {
                console.error('Error fetching EMG details:', error);
                res.status(500).send('Error fetching EMG details');
            }
        });

        // Save the EMG details for a game session
        app.post('/saveEMGdetails', async (req, res) => {
            const { gameSessionId, gameId, motorSpeeds, MotorAngles, EMGOutputs } = req.body;
            try {
                await EMGCollection.insertOne({ gameSessionId, gameId, motorSpeeds, MotorAngles, EMGOutputs });
                res.status(201).send('EMG details saved successfully');
            } catch (error) {
                console.error('Error saving EMG details:', error);
                res.status(500).send('Error saving EMG details');
            }
        });

        // Base route
        app.get('/', (req, res) => {
            res.send('Hello World');
        });

        app.listen(3000, () => {
            console.log('Server is running on port 3000');
        });
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}

connectToMongoDB();