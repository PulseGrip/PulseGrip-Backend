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
    router.get('/games', authMiddleware, async (req, res) => {
        try {
            const games = await gamesCollection.find({}).toArray();
            res.status(200).json(games);
        } catch (error) {
            console.error('Error fetching games:', error);
            res.status(500).send('Error fetching games');
        }
    });

    // Get 10 top scores for the game
    router.get('/topScores/:gameId', authMiddleware, async (req, res) => {
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
    router.post('/score', async (req, res) => {
        try {
            const { gameSessionId, gameId, score } = req.body;
            const time = new Date();
            await scoresCollection.insertOne({ gameSessionId: new ObjectId(gameSessionId), gameId: new ObjectId(gameId), score: score, time });
            res.status(201).send('Score saved successfully');
        } catch (error) {
            console.error('Error saving score:', error);
            res.status(500).send('Error saving score');
        }
    });

    // Fetch the threshold for each game
    router.get('/threshold/:gameId', authMiddleware, async (req, res) => {
        try {
            const { gameId } = req.params;
            const threshold = await thresholdsCollection.findOne({ gameId: new ObjectId(gameId) });
            res.status(200).json(threshold.value);
        } catch (error) {
            console.error('Error fetching threshold:', error);
            res.status(500).send('Error fetching threshold');
        }
    });

    // Set the threshold for a game
    router.put('/threshold', authMiddleware, async (req, res) => {
        try {
            const { gameId, threshold } = req.body;
            await thresholdsCollection.updateOne({ gameId: new ObjectId(gameId) }, { $set: { value: threshold } }, { upsert: true });
            res.status(200).send('Threshold updated successfully');
        } catch (error) {
            console.error('Error updating threshold:', error);
            res.status(500).send('Error updating threshold');
        }
    });

    // Fetch all the details (EMG and Score) for a game session
    router.get('/getGameSessionResult/:gameSessionId', authMiddleware, async (req, res) => {
        try {
            const { gameSessionId } = req.params;
            const EMGdetails = await EMGCollection.findOne({ gameSessionId });
            const score = await scoresCollection.findOne({ gameSessionId });
            const output = {
                emgId: EMGdetails._id,
                gameId: EMGdetails.gameId,
                gameSessionId: EMGdetails.gameSessionId,
                motorSpeeds: EMGdetails.motorSpeeds,
                motorAngles: EMGdetails.motorAngles,
                EMGoutputs: EMGdetails.EMGoutputs,
                score: score.score,
                time: score.time
            }
            res.status(200).json(output);
        } catch (error) {
            console.error('Error fetching tech details:', error);
            res.status(500).send('Error fetching tech details');
        }
    });

    // Save the EMG details for a game session
    router.post('/saveEMGdetails', async (req, res) => {
        const { gameSessionId, gameId, motorSpeeds, motorAngles, EMGoutputs } = req.body;
        try {
            await EMGCollection.insertOne({ gameSessionId, gameId, motorSpeeds, motorAngles, EMGoutputs });
            res.status(201).send('EMG details saved successfully');
        } catch (error) {
            console.error('Error saving EMG details:', error);
            res.status(500).send('Error saving EMG details');
        }
    });

    return router;
};