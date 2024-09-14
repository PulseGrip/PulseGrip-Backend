const express = require('express');
const { ObjectId } = require('mongodb');
const authMiddleware = require('../middlewares/auth');

module.exports = (dataDb) => {
    const router = express.Router();
    const thresholdsCollection = dataDb.collection('thresholds');
    const scoresCollection = dataDb.collection('scores');
    const gamesCollection = dataDb.collection('games');
    const EMGCollection = dataDb.collection('emg');

    // Fetch all the games
    router.get('/games', async (req, res) => {
        try {
            const games = await gamesCollection.find({}).toArray();
            res.status(200).json(games);
        } catch (error) {
            console.error('Error fetching games:', error);
            res.status(500).send('Error fetching games');
        }
    });

    // Get 10 top scores for the game
    router.get('/topScores/:gameId', async (req, res) => {
        try {
            const { gameId } = req.params;
            const query = ObjectId.isValid(gameId) ? { gameId: new ObjectId(gameId) } : { gameId: gameId };
            const topScores = await scoresCollection.find(query).sort({ score: -1 }).limit(10).toArray();
            res.status(200).json(topScores);
        } catch (error) {
            console.error('Error fetching top scores:', error);
            res.status(500).send('Error fetching top scores');
        }
    });

    // Add a new score to the database
    router.post('/score', async (req, res) => {
        try {
            const { gameId, score } = req.body;
            const time = new Date();
            await scoresCollection.insertOne({ gameId: new ObjectId(gameId), score: parseInt(score), time });
            res.status(201).send('Score saved successfully');
        } catch (error) {
            console.error('Error saving score:', error);
            res.status(500).send('Error saving score');
        }
    });

    // Fetch the threshold for each game
    router.get('/threshold', async (req, res) => {
        try {
            const threshold = await thresholdsCollection.findOne({});
            if (!threshold) {
                return res.status(404).send('Threshold not found');
            }
            res.status(200).json(threshold.value);
        } catch (error) {
            console.error('Error fetching threshold:', error);
            res.status(500).send('Error fetching threshold');
        }
    });

    // Set the threshold
    router.put('/threshold', async (req, res) => {
        try {
            const { threshold } = req.body;
            await thresholdsCollection.updateOne({}, { $set: { value: threshold } }, { upsert: true });
            res.status(200).send('Threshold updated successfully');
        } catch (error) {
            console.error('Error updating threshold:', error);
            res.status(500).send('Error updating threshold');
        }
    });

    // Save the EMG details
    router.post('/saveEMGdetails', async (req, res) => {
        const { motorSpeed, motorAngle, isClosed } = req.body;
        try {
            const time = new Date();
            await EMGCollection.insertOne({ motorSpeed, motorAngle, isClosed, time });
            res.status(201).send('EMG details saved successfully');
        } catch (error) {
            console.error('Error saving EMG details:', error);
            res.status(500).send('Error saving EMG details');
        }
    });

    // Fetch the EMG details sorted by time
    router.get('/EMGdetails', async (req, res) => {
        try {
            const EMGdetails = await EMGCollection.find({}).sort({ time: -1 }).toArray();
            res.status(200).json(EMGdetails);
        } catch (error) {
            console.error('Error fetching EMG details:', error);
            res.status(500).send('Error fetching EMG details');
        }
    });

    // Stream the latest scores
    router.get('/streamScores', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const changeStream = scoresCollection.watch();
        changeStream.on('change', async (change) => {
            if (change.operationType === 'insert') {
                const latestScores = await scoresCollection.find({}).sort({ time: -1 }).limit(10).toArray();
                res.write(`data: ${JSON.stringify(latestScores)}\n\n`);
            }
        });

        req.on('close', () => {
            changeStream.close();
            res.end();
        });
    });

    // Stream the latest EMG data
    router.get('/streamEMG', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const changeStream = EMGCollection.watch();
        changeStream.on('change', async (change) => {
            if (change.operationType === 'insert') {
                const latestEMG = await EMGCollection.find({}).sort({ time: -1 }).limit(10).toArray();
                res.write(`data: ${JSON.stringify(latestEMG)}\n\n`);
            }
        });

        req.on('close', () => {
            changeStream.close();
            res.end();
        });
    });

    return router;
};