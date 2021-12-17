const { MongoClient } = require("mongodb");
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const auth = require("./auth.js");

// Express server stuff
const app = express();
const port = process.env.PORT;

// Middleware
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(cors());

// Replace the following with your Atlas connection string
const client = new MongoClient(process.env.FINAL_URL);

// The database to use
const dbName = process.env.DBNAME;

// Root route
app.get("/", (req, res) => {
    res.status(300).redirect("/info.html");
});

app.get("/users", async (req, res) => {
    try {
        // Connecting to db
        await client.connect();
        // Retrieve the collection users
        const col = client.db(dbName).collection("users");
        const users = await col.find({}).toArray();

        // Send back the file
        res.status(200).send(users);
    } catch (e) {
        res.status(500).send({
            error: "Could not retrieve all users",
            value: e,
        });
    } finally {
        await client.close;
    }
});

// Returns user json
app.post("/users/register", async (req, res) => {
    try {
        // Connecting to db
        await client.connect();
        // Collection users
        const col = client.db(dbName).collection("users");

        // Validation
        // Checking if input fields are empty
        if (!req.body.username || !req.body.email || !req.body.password) {
            throw new Error("Bad request. You are either missing a username, email or password");
        }
        // Checking if username already exists
        const checkUsername = await col.findOne({
            username: req.body.username,
        });
        if (checkUsername) {
            throw new Error(`An account with username "${req.body.username}" already exists`);
        }
        // Checking if email already exists
        const checkUserEmail = await col.findOne({
            email: req.body.email,
        });
        if (checkUserEmail) {
            throw new Error(`An account with email "${req.body.email}" already exists`);
        }

        // Hashing password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(req.body.password, salt);

        // Creating token
        const token = jwt.sign({ sub: req.body.email, password: req.body.password }, `${process.env.TOKEN_KEY}`, { expiresIn: 60 * 60 });

        // Creating user
        let newUser = {
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            token: token,
        };

        // Insert into the database
        let insertRes = await col.insertOne(newUser);
        // Send back success message
        res.status(201).json(newUser);
    } catch (e) {
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close;
    }
});

// Returns user json
app.post("/users/login", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("users");

        // Validate that there is a username and a password in query
        if (!req.body.email || !req.body.password) {
            throw new Error("Missing email or password in body.");
        }
        // Look for account with given email
        const user = await col.findOne({ email: req.body.email });
        if (!user) {
            throw new Error("Account with this e-mail does not exist.");
        }
        // Compare the given password to the password stored in the database
        const isPasswordCorrect = bcrypt.compareSync(req.body.password, user.password);

        // Send success login message
        if (isPasswordCorrect) {
            // Create new token that expires in 1 hour
            const newToken = jwt.sign({ sub: req.body.email, password: req.body.password }, `${process.env.TOKEN_KEY}`, { expiresIn: 60 * 60 });
            // Replacing old user token with new token
            user.token = newToken;
            // Updating token in users collection
            const updatedUser = await col.updateOne({ email: req.body.email }, { $set: { token: `${newToken}` } });
            res.status(200).json(user);
        } else {
            throw new Error("Wrong password.");
        }
    } catch (e) {
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close;
    }
});

// Returns a single user found by username TOKEN REQUIRED
app.get("/users/:username", auth, async (req, res) => {
    try {
        await client.connect();

        const col = client.db(dbName).collection("users");
        const user = await col.findOne({ username: req.query.username }, { token: 0 });
        // No clue why it is not excluding token from user
        if (!user) {
            res.status(400).send({ message: `User with name ${req.query.username} does not exist.` });
        } else {
            res.status(200).send(user);
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

// Deletes the currently logged in user TOKEN REQUIRED
app.delete("/users/delete", auth, async (req, res) => {
    try {
        await client.connect();

        const col = client.db(dbName).collection("users");
        // TL;DR
        // When a user first creates an account or logs in. The rest api will make a token for him
        // This token will be returned as a json document when making a post register or login call
        // This token should be stored in a cookie before redirecting the user to the homepage.
        // User can only delete his own account

        // Determining who the user is for success message handling
        const deletedUser = await col.findOne({ token: `${req.headers["x-access-token"]}` });
        // Delete user based on the token given along with the header (Token should be obtained from cookie upon login/registering)
        // to make sure the user is deleting himself
        const deleteUser = await col.deleteOne({ token: `${req.headers["x-access-token"]}` });
        if (deleteUser.deletedCount === 1) {
            res.status(200).send({ message: `User ${deletedUser.username} successfully deleted` });
        } else {
            res.status(404).send({ message: `No users founds. Deleted 0 users` });
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Api is running at https://localhost:${port}`);
});
