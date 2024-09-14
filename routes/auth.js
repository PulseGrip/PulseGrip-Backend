const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (authDb) => {
    const router = express.Router();

    // Register a new user
    router.post('/register', async (req, res) => {
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
    router.post('/login', async (req, res) => {
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

    return router;
};