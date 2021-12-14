const { MongoClient } = require("mongodb");
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Express server stuff
const app = express();
const port = process.env.PORT;

// Middleware
app.use(express.static("public"));
app.use(bodyParser.json());

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
        console.log(e);
        res.status(500).send({
            error: "Could not retrieve all users",
            value: e,
        });
    } finally {
        await client.close;
    }
});

app.post("/users/register", async (req, res) => {
    try {
        // Connecting to db
        await client.connect();
        // Collection users
        const col = client.db(dbName).collection("users");

        // Validation
        // Checking if input fields are empty
        if (!req.body.username || !req.body.email || !req.body.password) {
            res.status(400).send("Bad request. You are either missing a username, email or password");
            return;
        }
        // Checking if email already exists
        const user = await col.findOne({
            email: req.body.email,
        });
        if (user) {
            res.status(400).send(`An account with email "${req.body.email}" already exists`);
            return;
        }

        // Hashing password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(req.body.password, salt);
        console.log(hashedPassword);

        // Creating user
        let newUser = {
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
        };

        // Insert into the database
        let insertRes = await col.insertOne(newUser);
        // Send back success message
        res.status(201).json(newUser);

        return;
    } catch (error) {
        res.status(500).send({
            error: "Something went wrong... Try again later",
            value: error,
        });
    } finally {
        await client.close;
    }
});

app.listen(port, () => {
    console.log(`Api is running at https://localhost:${port}`);
});
