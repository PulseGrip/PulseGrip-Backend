const cors = require('cors');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 });

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const dataDb = client.db('pg-db');
        const authDb = client.db('pg-auth-db');
        const thresholdsCollection = dataDb.collection('thresholds');
        const scoresCollection = dataDb.collection('scores');
        const gamesCollection = dataDb.collection('games');
        const EMGCollection = dataDb.collection('emg');

        // Register a new user
        app.post('/auth/register', async (req, res) => {
            const { username, password, fullName } = req.body;
            try {
                const existingUser = await authDb.collection('users').findOne({ username });
                if (existingUser) {
                    return res.status(400).send('User already exists');
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                const result = await authDb.collection('users').insertOne({ username, fullName, password: hashedPassword });
                const token = jwt.sign({ _id: result.insertedId }, JWT_SECRET, { expiresIn: '3h' });
                res.status(201).json({ message: 'User created successfully', token });
            } catch (error) {
                console.error('Error signing up:', error);
                res.status(500).send('Error signing up');
            }
        });

        // Login a user
        app.post('/auth/login', async (req, res) => {
            const { username, password } = req.body;
            try {
                const user = await authDb.collection('users').findOne({ username });
                if (!user) {
                    return res.status(400).send('User does not exist');
                }
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) {
                    return res.status(400).send('Invalid password');
                }
                const token = jwt.sign({ _id: user._id }, JWT_SECRET, { expiresIn: '3h' });
                res.status(200).json({ message: 'Login successful', token });
            } catch (error) {
                console.error('Error logging in:', error);
                res.status(500).send('Error logging in');
            }
        });

        // Middleware to authenticate the user
        function authMiddleware(req, res, next) {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).send('Unauthorized');
            }
            jwt.verify(token, JWT_SECRET, (err, user) => {
                if (err) {
                    return res.status(403).send('Forbidden');
                }
                req.user = user;
                next();
            });
        }

        // Fetch all the games
        app.get('/games', authMiddleware, async (req, res) => {
            try {
                const games = await gamesCollection.find({}).toArray();
                console.log(games);
                res.status(200).json(games);
            } catch (error) {
                console.error('Error fetching games:', error);
                res.status(500).send('Error fetching games');
            }
        });

        // Get 10 top scores for the game
        app.get('/topScores/:gameId', authMiddleware, async (req, res) => {
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
        app.post('/score', authMiddleware, async (req, res) => {
            try {
                const { gameSessionId, gameId, score } = req.body;
                const time = new Date();
                await scoresCollection.insertOne({ gameSessionId, gameId, score, time });
                res.status(201).send('Score saved successfully');
            } catch (error) {
                console.error('Error saving score:', error);
                res.status(500).send('Error saving score');
            }
        });

        // Fetch the threshold for each game
        app.get('/threshold/:gameId', authMiddleware, async (req, res) => {
            try {
                const { gameId } = req.params;
                const threshold = await thresholdsCollection.findOne({ gameId: new ObjectId(gameId) });
                console.log(threshold);
                res.status(200).json(threshold.value);
            } catch (error) {
                console.error('Error fetching threshold:', error);
                res.status(500).send('Error fetching threshold');
            }
        });

        // Set the threshold for a game
        app.put('/threshold', authMiddleware, async (req, res) => {
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
        app.get('/getGameSessionResult/:gameSessionId', authMiddleware, async (req, res) => {
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
        app.post('/saveEMGdetails', authMiddleware, async (req, res) => {
            const { gameSessionId, gameId, motorSpeeds, motorAngles, EMGoutputs } = req.body;
            try {
                await EMGCollection.insertOne({ gameSessionId, gameId, motorSpeeds, motorAngles, EMGoutputs });
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