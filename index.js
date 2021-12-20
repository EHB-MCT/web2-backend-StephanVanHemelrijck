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

// Increasing payload size
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
    bodyParser.urlencoded({
        limit: "50mb",
        extended: true,
        parameterLimit: 50000,
    })
);

// Replace the following with your Atlas connection string
const client = new MongoClient(process.env.FINAL_URL);

// The database to use
const dbName = process.env.DBNAME;

// Add headers before the routes are defined
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1/");

    // Request methods you wish to allow
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");

    // Request headers you wish to allow
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader("Access-Control-Allow-Credentials", true);

    // Pass to next layer of middleware
    next();
});

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
        const token = jwt.sign({ sub: req.body.email, password: hashedPassword }, `${process.env.TOKEN_KEY}`, { expiresIn: 60 * 60 });

        // Creating user
        let newUser = {
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            createdAt: new Date(),
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
            const newToken = jwt.sign({ sub: req.body.email, password: user.password }, `${process.env.TOKEN_KEY}`, { expiresIn: 60 * 60 });
            // Replacing old user token with new token
            user.token = newToken;
            // Updating token in users collection
            const updatedUser = await col.updateOne({ email: req.body.email }, { $set: { token: newToken } });
            console.log(user.token);
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

// Returns a single user found by username
app.get("/users/:username", async (req, res) => {
    try {
        await client.connect();

        const col = client.db(dbName).collection("users");
        const user = await col.findOne({ username: req.query.username }, { token: 0 });
        // No clue why it is not excluding token in json
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

// Delete user by email
app.delete("/users/:email", async (req, res) => {
    try {
        await client.connect();

        const col = client.db(dbName).collection("users");
        // TL;DR
        // //When a user first creates an account or logs in. The rest api will make a token for him
        // //This token will be returned as a json document when making a post register or login call
        // //This token should be stored in a cookie before redirecting the user to the homepage.
        // // User can only delete his own account

        // // // // These comments dont apply yet because I have currently disabled auth tokens

        // Determining who the user is for success message handling
        const deletedUser = await col.findOne({ email: `${req.query.email}` });
        // // Delete user based on the token given along with the header (Token should be obtained from cookie upon login/registering)
        // // to make sure the user is deleting himself

        // Deleting user based on email
        const deleteUser = await col.deleteOne({ email: `${req.query.email}` });
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

app.get("/routes", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("routes");
        const routes = await col.find({}).toArray();
        // Send back the file
        res.status(200).send(routes);
    } catch (e) {
        res.status(500).send({
            error: "Could not retrieve all routes",
            value: e,
        });
    } finally {
        await client.close;
    }
});

app.post("/routes", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("routes");

        // Validation;
        if (!req.body.created_by || !req.body.route_coordinates || !req.body.route_img_url || !req.body.route_name || !req.body.route_polyline_encoded) {
            throw new Error(
                "Make sure you have all parameters filled in. Needs a 'created_by', 'route_coordinates','route_img_url', 'route_name' and 'route_polyline_encoded'"
            );
        }

        // Create the file
        const newRoute = {
            created_by: req.body.created_by,
            route_name: req.body.route_name,
            route_coordinates: req.body.route_coordinates,
            route_polyline_encoded: req.body.route_polyline_encoded,
            route_img_url: req.body.route_img_url,
        };

        // Push file to collection
        await col.insertOne(newRoute);

        // // Send back file
        res.status(200).send(newRoute);
    } catch (e) {
        res.status(500).send({
            error: e.message,
            value: e,
        });
    }
});

app.listen(port, () => {
    console.log(`Api is running at https://localhost:${port}`);
});
