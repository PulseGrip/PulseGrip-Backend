const cors = require('cors');
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();

app.use(cors());
app.use(express.json());

const uri = 'your_mongodb_connection_string';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect(err => {
    if (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
    const db = client.db('your_database_name');
    const thresholdsCollection = db.collection('thresholds');
    const scoresCollection = db.collection('scores');
    const gamesCollection = db.collection('games');
    const EMGCollection = db.collection('EMG');

    app.get('/topScores', async (req, res) => {
        try {
            const topScores = await scoresCollection.find().sort({ score: -1 }).limit(10).toArray();
            res.status(200).json(topScores);
        } catch (error) {
            res.status(500).send('Error fetching top scores');
        }
    });

    app.post('/score', async (req, res) => {
        try {
            const { score } = req.body;
            await scoresCollection.insertOne({ score });
            res.status(201).send('Score saved successfully');
        } catch (error) {
            res.status(500).send('Error saving score');
        }
    });

    app.get('/threshold', async (req, res) => {
        try {
            const threshold = await thresholdsCollection.findOne();
            res.status(200).json(threshold);
        } catch (error) {
            res.status(500).send('Error fetching threshold');
        }
    });

    app.post('/threshold', async (req, res) => {
        try {
            const { threshold } = req.body;
            await thresholdsCollection.insertOne({ threshold });
            res.status(201).send('Threshold set successfully');
        } catch (error) {
            res.status(500).send('Error setting threshold');
        }
    });

    app.get('/getEMGdetails/:gameId', async (req, res) => {
        try {
            const { gameId } = req.params;
            const EMGdetails = await EMGCollection.find({ gameId }).toArray();
            res.status(200).json(EMGdetails);
        } catch (error) {
            res.status(500).send('Error fetching EMG details');
        }
    });

    app.post('/saveEMGdetails', async (req, res) => {
        const { gameId, motorSpeeds, MotorAngles, EMGOutputs } = req.body;
        try {
            await EMGCollection.insertOne({ gameId, motorSpeeds, MotorAngles, EMGOutputs });
            res.status(201).send('EMG details saved successfully');
        } catch (error) {
            res.status(500).send('Error saving EMG details');
        }
    });

    app.get('/', (req, res) => {
        res.send('Hello World');
    });

    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
});